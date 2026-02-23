@echo off
REM Script to commit with automatic version bump
REM Usage: commit-with-auto-bump.bat "commit message"

if "%~1"=="" (
    echo Usage: commit-with-auto-bump.bat "commit message"
    exit /b 1
)

setlocal enabledelayedexpansion

REM Change to frontend directory
cd /d "%~dp0frontend"

echo.
echo === Committing changes: %~1 ===
echo.

REM Stage changes
git add -A

REM Commit with the provided message
git commit -m "%~1"

if errorlevel 1 (
    echo Error: Commit failed or nothing to commit
    exit /b 1
)

REM Auto-bump version
echo.
echo === Auto-bumping version ===
echo.

node "%~dp0frontend\post-commit-hook.js"

if errorlevel 1 (
    echo Warning: Version bump had issues, but commit is complete
    exit /b 0
)

exit /b 0
