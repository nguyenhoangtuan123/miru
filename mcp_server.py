from pathlib import Path
import importlib.util
import sys

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

spec = importlib.util.spec_from_file_location("_miru_mcp_server", SRC / "mcp_server.py")
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
app = module.app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("mcp_server:app", host="127.0.0.1", port=8020, reload=True, app_dir="src")
