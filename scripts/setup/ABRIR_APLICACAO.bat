@echo off
color 0D
cls
echo.
echo    ================================================================
echo                    ACCENTURE TECHNOLOGY SOLUTIONS
echo    ================================================================
echo.
echo                      MAINFRAME AI ASSISTANT
echo                   Enterprise Knowledge Base v1.0
echo.
echo    ================================================================
echo.
echo    [*] Starting application...
echo.

:: Check if the HTML file exists
if not exist "%~dp0src\mainframe-knowledge-base.html" (
    echo    [ERROR] Application file not found!
    echo.
    echo    Please ensure mainframe-knowledge-base.html exists in src folder
    echo.
    pause
    exit /b 1
)

:: Try to open in default browser
echo    [*] Opening in your default browser...
echo.
start "" "%~dp0src\mainframe-knowledge-base.html"

echo    ================================================================
echo.
echo    [SUCCESS] Application launched!
echo.
echo    The Accenture Mainframe AI Assistant is now running in your
echo    browser. If the browser doesn't open automatically, please
echo    open the following file manually:
echo.
echo    %~dp0src\mainframe-knowledge-base.html
echo.
echo    ================================================================
echo.
echo    Features Available:
echo    - Search 25+ mainframe error solutions
echo    - VSAM, JCL, COBOL, DB2, CICS, IMS support
echo    - Real-time filtering and search
echo    - Professional Accenture branding
echo.
echo    Copyright (c) 2025 Accenture. All rights reserved.
echo    ================================================================
echo.
echo    Press any key to close this window...
pause >nul