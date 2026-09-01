import asyncio
import hmac
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, Response
from pypdf import PdfReader


MAX_DOCX_BYTES = 20 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024
CONVERSION_TIMEOUT_SECONDS = 90
SERVICE_VERSION = "2026-09-01-v2"
conversion_lock = asyncio.Lock()
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def authorize(supplied: str | None) -> None:
    expected = os.environ.get("CONVERTER_SHARED_SECRET", "")
    if not expected or not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def validate_docx(data: bytes) -> None:
    if not data or len(data) > MAX_DOCX_BYTES:
        raise HTTPException(status_code=413, detail="Invalid DOCX size")
    if not data.startswith(b"PK"):
        raise HTTPException(status_code=400, detail="Invalid DOCX")


def validate_docx_file(path: Path) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                raise ValueError("not a Word document")
            if sum(item.file_size for item in archive.infolist()) > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("expanded document too large")
    except (zipfile.BadZipFile, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid DOCX") from error


def safe_process_output(value: bytes) -> str:
    text = value.decode("utf-8", errors="replace")
    text = re.sub(r"(?:/tmp|/app)/[^\s]+", "<temp>", text)
    return " ".join(text.split())[:500]


def convert(data: bytes) -> tuple[bytes, int]:
    with tempfile.TemporaryDirectory(prefix="softreg-pdf-") as directory:
        root = Path(directory)
        input_dir = root / "input"
        output_dir = root / "output"
        input_dir.mkdir()
        output_dir.mkdir()
        input_path = input_dir / "source.docx"
        output_path = output_dir / "source.pdf"
        profile_path = root / "lo-profile"
        home_path = root / "home"
        tmp_path = root / "tmp"
        home_path.mkdir()
        tmp_path.mkdir()
        input_path.write_bytes(data)
        validate_docx_file(input_path)
        soffice_bin = os.environ.get("LIBREOFFICE_BIN", "soffice")
        command = [
            soffice_bin,
            "--headless",
            "--nologo",
            "--nodefault",
            "--norestore",
            "--nolockcheck",
            "--nofirststartwizard",
            f"-env:UserInstallation={profile_path.as_uri()}",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(output_dir),
            str(input_path),
        ]
        try:
            completed = subprocess.run(
                command,
                check=False,
                timeout=CONVERSION_TIMEOUT_SECONDS,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={
                    **os.environ,
                    "HOME": str(home_path),
                    "TMPDIR": str(tmp_path),
                    "SAL_USE_VCLPLUGIN": "gen",
                },
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=504, detail="Conversion timed out") from error
        if completed.returncode != 0:
            print(
                "LibreOffice conversion failed "
                f"(exit={completed.returncode}, stderr={safe_process_output(completed.stderr)})",
                file=sys.stderr,
                flush=True,
            )
            raise HTTPException(status_code=422, detail="Conversion failed")
        if not output_path.exists():
            candidates = [path for path in output_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf"]
            print(
                "LibreOffice returned without the expected PDF "
                f"(stdout={safe_process_output(completed.stdout)}, "
                f"stderr={safe_process_output(completed.stderr)}, "
                f"candidates={[path.name for path in candidates]})",
                file=sys.stderr,
                flush=True,
            )
            if len(candidates) == 1:
                output_path = candidates[0]
            else:
                diagnostic = safe_process_output(completed.stderr) or safe_process_output(completed.stdout)
                detail = "Conversion produced no PDF"
                if diagnostic:
                    detail += f" ({diagnostic})"
                raise HTTPException(status_code=422, detail=detail)
        pdf = output_path.read_bytes()
        if not pdf.startswith(b"%PDF-") or b"%%EOF" not in pdf[-2048:]:
            raise HTTPException(status_code=422, detail="Invalid PDF output")
        page_count = len(PdfReader(output_path).pages)
        return pdf, page_count


@app.get("/health")
def health() -> dict[str, str | None]:
    return {"status": "ok", "serviceVersion": SERVICE_VERSION, "soffice": shutil.which("soffice")}


@app.post("/convert/docx-to-pdf")
async def docx_to_pdf(
    request: Request,
    x_converter_secret: str | None = Header(default=None),
) -> Response:
    authorize(x_converter_secret)
    try:
        content_length = int(request.headers.get("content-length", "0") or "0")
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Invalid content length") from error
    if content_length <= 0 or content_length > MAX_DOCX_BYTES:
        raise HTTPException(status_code=413, detail="Invalid DOCX size")
    data = await request.body()
    validate_docx(data)
    async with conversion_lock:
        pdf, page_count = await asyncio.to_thread(convert, data)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"x-pdf-page-count": str(page_count), "Cache-Control": "no-store"},
    )
