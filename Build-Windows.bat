@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SimpRestore - Windows build
color 0B

echo.
echo  SimpRestore - Windows build for repository maintainers
echo  ------------------------------------------------------
echo  End users should download the ready-made installer from GitHub Releases.
echo  This script builds the project from source and needs internet on first run.
echo.
where node >nul 2>nul
if errorlevel 1 (
  where winget >nul 2>nul
  if errorlevel 1 goto neednode
  echo Node.js 22 LTS is missing. Trying Windows Package Manager...
  winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
  set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\nodejs;%PATH%"
  where node >nul 2>nul
  if errorlevel 1 goto neednode
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if "%NODE_MAJOR%"=="" goto neednode
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22 or newer is required.
  echo Install Node.js 22 LTS from https://nodejs.org/ and run this file again.
  goto fail
)

rem Keep npm, Electron, builder and temporary caches on the repository drive.
rem This avoids filling AppData/npm-cache on C: when the repository is elsewhere.
set "BUILD_CACHE=%~dp0.build-cache"
set "npm_config_cache=%BUILD_CACHE%\npm"
set "ELECTRON_CACHE=%BUILD_CACHE%\electron"
set "ELECTRON_BUILDER_CACHE=%BUILD_CACHE%\electron-builder"
set "TEMP=%BUILD_CACHE%\tmp"
set "TMP=%BUILD_CACHE%\tmp"
if not exist "%npm_config_cache%" mkdir "%npm_config_cache%" >nul 2>nul
if not exist "%ELECTRON_CACHE%" mkdir "%ELECTRON_CACHE%" >nul 2>nul
if not exist "%ELECTRON_BUILDER_CACHE%" mkdir "%ELECTRON_BUILDER_CACHE%" >nul 2>nul
if not exist "%TEMP%" mkdir "%TEMP%" >nul 2>nul

for /f %%G in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Resolve-Path .).Path; $d=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($p)); [math]::Floor($d.AvailableFreeSpace / 1GB)" 2^>nul') do set "FREE_GB=%%G"
echo Build caches: "%BUILD_CACHE%"
if "%FREE_GB%"=="" (
  echo WARNING: Could not determine free disk space. The build will continue.
) else (
  echo Free space on repository drive: %FREE_GB% GB
  if %FREE_GB% LSS 6 goto lowspace
)
echo.
echo [1/3] Installing dependencies. npm cache is stored inside this repository.
call npm install --no-audit --no-fund
if errorlevel 1 goto installfail

echo.
echo [2/3] Preparing Exoprobe and FFmpeg for offline use.
call npm run prepare:tools
if errorlevel 1 goto fail

echo.
echo [3/3] Building the installer and portable app.
call npx electron-builder --win nsis portable --publish never
if errorlevel 1 goto buildfail

echo.
echo Build complete. Opening the release folder...
start "" "%~dp0release"
echo The output includes an installer and a portable EXE.
pause
exit /b 0

:lowspace
echo.
echo ERROR: Only %FREE_GB% GB is free on the drive containing this project.
echo A Windows build typically needs at least 6 GB of free space for npm, Electron, FFmpeg and packaging temp files.
echo.
echo Recommended fix:
echo  1. Move the entire SimpRestore repository to a drive with at least 6 GB free (for example D:).
echo  2. Run Build-Windows.bat from that new location.
echo.
echo Build stopped before installing packages to avoid another ENOSPC failure.
pause
exit /b 1

:installfail
echo.
echo Dependency installation failed. If the message contains ENOSPC, the repository drive is still too full.
echo Free at least 6 GB on that drive or move this folder to a drive with more space.
echo The local build cache is at: "%BUILD_CACHE%"
echo You can safely delete .build-cache after closing SimpRestore build tools to reclaim space; the next build downloads dependencies again.
pause
exit /b 1

:buildfail
echo.
echo Packaging failed. Check the final error above and confirm at least 6 GB remains free.
echo Build caches and temporary files are located under .build-cache on this repository drive.
pause
exit /b 1

:neednode
echo.
echo Node.js could not be installed automatically.
echo Install Node.js 22 LTS from https://nodejs.org/ and run this file again.
pause
exit /b 1

:fail
echo.
echo Build preparation failed. Read the error above and check internet access, disk space, and third-party tool setup.
pause
exit /b 1
