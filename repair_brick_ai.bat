@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_CMD="

where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py"
)

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PYTHON_CMD=python"
  )
)

if not defined PYTHON_CMD (
  echo Python was not found on this machine.
  echo Install Python 3.11+ first, then run this file again.
  exit /b 1
)

echo Recreating BRICK AI virtual environment...
if exist ".venv" rmdir /s /q ".venv"

%PYTHON_CMD% -m venv .venv
if errorlevel 1 (
  echo Failed to create virtual environment.
  exit /b %errorlevel%
)

echo Upgrading pip...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b %errorlevel%

echo Installing BRICK AI requirements...
call ".venv\Scripts\python.exe" -m pip install -r ".\house-price-predictor\requirements.txt"
if errorlevel 1 exit /b %errorlevel%

echo Repair complete.
echo You can now run start_brick_ai.bat
exit /b 0
