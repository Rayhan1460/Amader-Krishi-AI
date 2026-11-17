# Diagnostic script to isolate import and test execution hangs
import sys
import os
import time
import subprocess
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PYTHON_EXE = BACKEND_DIR / ".venv2" / "Scripts" / "python.exe"

TEST_TARGETS = [
    ("1. app.config", "import app.config"),
    ("2. tensorflow", "import tensorflow as tf"),
    ("3. app.models.manifest", "import app.models.manifest"),
    ("4. app.services.chat_tools", "import app.services.chat_tools"),
    ("5. app.core.chat_provider", "import app.core.chat_provider"),
    ("6. app.db", "import app.db"),
    ("7. app.main", "import app.main"),
    ("8. rule_based_generate", "from app.core.chat_provider import RuleBasedChatProvider; import asyncio; p = RuleBasedChatProvider(); r = asyncio.run(p.generate_response([{'role': 'user', 'content': 'test'}])); print('Reply:', r[0][:40])"),
    ("9. test_rule_based_func", "import tests.test_chat_provider as t; t.test_rule_based_provider_inquiries(); print('Func done')"),
]

SUBPROCESS_CODE_TEMPLATE = """
import sys
import time
import faulthandler

# Dump traceback to stderr if execution exceeds 15 seconds
faulthandler.dump_traceback_later(15, repeat=False, file=sys.stderr)

print("[START] {name}", flush=True)
start_t = time.perf_counter()
try:
    {import_statement}
    elapsed = time.perf_counter() - start_t
    print(f"[SUCCESS] {name} in {{elapsed:.2f}}s", flush=True)
    sys.exit(0)
except Exception as e:
    elapsed = time.perf_counter() - start_t
    print(f"[FAILED] {name} after {{elapsed:.2f}}s with error: {{e}}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
"""

def main():
    print(f"===============================================================")
    print(f"  AGRISPHERE AI — ISOLATION IMPORT & HANG DIAGNOSTIC")
    print(f"  Interpreter: {PYTHON_EXE}")
    print(f"  Working Dir: {BACKEND_DIR}")
    print(f"===============================================================\n")

    results = []
    timeout_sec = 25

    for name, code in TEST_TARGETS:
        script = SUBPROCESS_CODE_TEMPLATE.format(name=name, import_statement=code)
        print(f"--- Running test: {name} (timeout={timeout_sec}s) ---")
        
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env["KERAS_HOME"] = str(BACKEND_DIR / ".keras")
        env["TF_ENABLE_ONEDNN_OPTS"] = "0"

        start_time = time.time()
        proc = subprocess.Popen(
            [str(PYTHON_EXE), "-u", "-c", script],
            cwd=str(BACKEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
        )

        timed_out = False
        try:
            stdout, stderr = proc.communicate(timeout=timeout_sec)
        except subprocess.TimeoutExpired:
            timed_out = True
            proc.kill()
            stdout, stderr = proc.communicate()

        duration = time.time() - start_time
        exit_code = proc.returncode

        status = "TIMEOUT" if timed_out else ("PASS" if exit_code == 0 else "FAIL")
        print(f"Result: {status} | Duration: {duration:.2f}s | ExitCode: {exit_code}")
        if stdout.strip():
            print(f"Stdout:\n{stdout.strip()}")
        if stderr.strip():
            print(f"Stderr:\n{stderr.strip()}")
        print()

        results.append((name, status, duration, exit_code, stderr))

    print("\n=================== DIAGNOSTIC SUMMARY ===================")
    for name, status, duration, exit_code, stderr in results:
        print(f"{name:30} : {status:7} ({duration:5.2f}s, exit {exit_code})")
        if status != "PASS" and stderr:
            print(f"  -> Diagnostics / Traceback snippet:\n  {stderr[:300].strip()}\n")

if __name__ == "__main__":
    main()

