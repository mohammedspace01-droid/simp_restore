# Changelog

## 0.2.3 — Windows packaging compatibility fix

- Updated electron-builder to 26.15.3, whose v26 configuration supports `win.signExecutable: false`.
- Disabled code signing for unsigned community builds while keeping executable resource editing enabled, so app icon and Windows metadata can still be applied.
- This also avoids the unsupported `signExecutable` schema error produced by the earlier pinned electron-builder 26.0.12 version.

## 0.2.2 — Workspace storage, error handling, and clearer responsible use

- Moved temporary extraction and Exoprobe output from Windows Temp to a temporary workspace on the selected library drive. This avoids consuming C: when the library is on another drive.
- Added archive-size estimation and a free-space preflight before extraction. Low-space errors now explain which drive to change and how to retry.
- Made Windows builds skip code signing when no signing certificate is provided, while retaining resource editing; maintainers should not need Developer Mode just to produce an unsigned local build.
- Converted `ENOSPC` failures from Exoprobe or export into actionable storage guidance and ensured temporary workspaces are cleaned up where possible.
- Added explicit temporary-storage guidance to the restore and overview screens.
- Made responsible-use requirements clearer at first launch and in the help page; the updated notice requires acknowledgement on upgrade.
- Made Mohammed Hamed's LinkedIn and Ko-fi support links visible in the welcome dialog and sidebar, as well as the guide page.
- Improved readability across the UI by increasing small text sizes and spacing.


## 0.2.1 — Maintainer links and build recovery

- Added creator LinkedIn and Ko-fi links to the app credits panel and README.
- Redirected npm, Electron, electron-builder and temporary build caches to `.build-cache/` on the repository drive.
- Added a preflight free-space check and clearer recovery instructions for `ENOSPC` failures.
- Reduced first-time npm install noise using `--no-audit --no-fund`.
- Updated project version and release metadata.


## 0.2.0 — UX and recovery reliability update

- Replaced the initial Arabic UI with an English-first, responsive desktop interface.
- Added byte-based archive extraction progress and ongoing status text during cache rejoining.
- Added safe ZIP path validation and archive size/entry limits.
- Added song-title and artist matching using the local SimpMusic music database.
- Added incremental recovery using `.simprestore-library.json` to avoid adding the same media ID twice.
- Added indexing and playback controls for supported local music folders.
- Added optional MP3 conversion and source-preservation controls.
- Added first-run responsible-use acknowledgement and open-source attribution.
- Added Windows Release build automation for installer and portable builds.

## 0.1.0

- Initial proof of concept for SimpMusic cache recovery, naming, and local playback.
