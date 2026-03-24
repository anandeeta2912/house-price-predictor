@echo off
setlocal

cd /d "%~dp0house-price-predictor"

set "VENV_PY=..\.venv\Scripts\python.exe"
set "ANACONDA_PY=C:\ProgramData\anaconda3\python.exe"

if exist "%VENV_PY%" (
  echo Checking BRICK AI dependencies in project virtual environment...
  call "%VENV_PY%" -c "import matplotlib, numpy, pandas, sklearn" >nul 2>nul
  if not errorlevel 1 (
    echo Starting BRICK AI with project virtual environment...
    call "%VENV_PY%" app.py
    exit /b %errorlevel%
  )

  echo Project virtual environment is missing required packages.
  echo Switching to the working Anaconda Python instead...
)

if exist "%ANACONDA_PY%" (
  echo Starting BRICK AI with Anaconda Python fallback...
  call "%ANACONDA_PY%" app.py
  exit /b %errorlevel%
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting BRICK AI with py launcher...
  py app.py
  exit /b %errorlevel%
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting BRICK AI with system python...
  python app.py
  exit /b %errorlevel%
)

echo Python was not found. Install Python 3.11+ or recreate the virtual environment first.
exit /b 1
