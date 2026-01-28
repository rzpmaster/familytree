@echo off
setlocal

REM Switch to backend directory
cd /d %~dp0

set VENV_DIR=.venv

REM Create venv if not exists
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [INFO] Creating venv...
    python -m venv %VENV_DIR%
)

REM Activate venv
call %VENV_DIR%\Scripts\activate.bat

REM Install deps
pip install -r requirements.txt

REM Start backend
uvicorn app.main:app --reload --port 8000

endlocal