import asyncio
import hmac
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request, Response
from pypdf import PdfReader


MAX_DOCX_BYTES = 20 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024
CONVERSION_TIMEOUT_SECONDS = 90
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


def convert(data: bytes) -> tuple[bytes, int]:
    with tempfile.TemporaryDirectory(prefix="softreg-pdf-") as directory:
        root = Path(directory)
        input_path = root / "input.docx"
        output_path = root / "input.pdf"
        profile_path = root / "lo-profile"
        input_path.write_bytes(data)
        validate_docx_file(input_path)
        command = [
            "soffice",
            "--headless",
            "--nologo",
            "--nodefault",
            "--nolockcheck",
            "--nofirststartwizard",
            f"-env:UserInstallation={profile_path.as_uri()}",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(root),
            str(input_path),
        ]
        try:
            subprocess.run(
                command,
                check=True,
                timeout=CONVERSION_TIMEOUT_SECONDS,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                env={**os.environ, "SAL_USE_VCLPLUGIN": "gen"},
            )
        except subprocess.TimeoutExpired as error:
            raise HTTPException(status_code=504, detail="Conversion timed out") from error
        except subprocess.CalledProcessError as error:
            raise HTTPException(status_code=422, detail="Conversion failed") from error
        if not output_path.exists():
            raise HTTPException(status_code=422, detail="Conversion produced no PDF")
        pdf = output_path.read_bytes()
        if not pdf.startswith(b"%PDF-") or b"%%EOF" not in pdf[-2048:]:
            raise HTTPException(status_code=422, detail="Invalid PDF output")
        page_count = len(PdfReader(output_path).pages)
        return pdf, page_count


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
