@echo off
setlocal
cd /d "%~dp0"

echo ============================
echo   ChessCoach AI - Git Update
echo ============================
echo.

git status --short
echo.

set /p CommitMsg="Commit message (leave blank for 'Update'): "
if "%CommitMsg%"=="" set CommitMsg=Update

git add -A
git commit -m "%CommitMsg%"

for /f "delims=" %%b in ('git branch --show-current') do set Branch=%%b

echo.
echo Pushing to GitHub (%Branch%)...
git push origin %Branch%

echo.
echo Done.
pause
