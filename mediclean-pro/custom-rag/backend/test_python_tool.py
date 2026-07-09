import sys
from io import StringIO

def execute_python_code(code: str) -> str:
    """Führt Python-Code aus und gibt die Konsolenausgabe zurück."""
    old_stdout = sys.stdout
    sys.stdout = mystdout = StringIO()
    try:
        exec(code, {})
        return mystdout.getvalue()
    except Exception as e:
        return str(e)
    finally:
        sys.stdout = old_stdout

print(execute_python_code("print('hello world')"))
