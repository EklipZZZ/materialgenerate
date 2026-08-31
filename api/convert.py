import hmac
import json
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit

ASSET_ROOT = Path(__file__).resolve().parent.parent / "assets"
sys.path.insert(0, str(ASSET_ROOT))

from code_convert import code_convert_main  # noqa: E402
from manual_convert import manual_convert_main  # noqa: E402


MAX_BODY_BYTES = 4 * 1024 * 1024
MAX_MARKDOWN_CHARS = 2_000_000


class handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Conversion requests contain user material; do not log request details.
        return

    def _send_json(self, status, message):
        payload = json.dumps({"code": status, "msg": message, "data": None}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if urlsplit(self.path).path not in ("/api/convert", "/api/convert.py"):
            self._send_json(404, "Not found")
            return

        expected = os.environ.get("CONVERTER_SHARED_SECRET", "")
        supplied = self.headers.get("x-converter-secret", "")
        if not expected or not hmac.compare_digest(supplied, expected):
            self._send_json(401, "Unauthorized")
            return

        try:
            length = int(self.headers.get("content-length", "0"))
        except ValueError:
            self._send_json(400, "Invalid request")
            return
        if length <= 0 or length > MAX_BODY_BYTES:
            self._send_json(413, "Request too large")
            return

        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            kind = body.get("kind")
            markdown = body.get("markdown")
            software_name = str(body.get("softwareName") or "未知软件")[:300]
            version = str(body.get("version") or "V1.0")[:100]
            if kind not in ("code", "manual") or not isinstance(markdown, str):
                raise ValueError("invalid conversion request")
            if len(markdown) > MAX_MARKDOWN_CHARS:
                raise ValueError("markdown is too large")

            with tempfile.TemporaryDirectory(prefix="materialgenerate-convert-") as directory:
                root = Path(directory)
                input_path = root / "input.md"
                output_path = root / "output.docx"
                input_path.write_text(markdown, encoding="utf-8")
                if kind == "code":
                    code_convert_main(str(input_path), str(output_path), software_name, version)
                else:
                    cover_path = ASSET_ROOT / "template.docx"
                    manual_convert_main(
                        str(input_path),
                        str(output_path),
                        software_name,
                        version,
                        str(cover_path) if cover_path.exists() else None,
                    )
                output = output_path.read_bytes()

            self.send_response(200)
            self.send_header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            self.send_header("Content-Length", str(len(output)))
            self.end_headers()
            self.wfile.write(output)
        except Exception:
            self._send_json(500, "DOCX conversion failed")
