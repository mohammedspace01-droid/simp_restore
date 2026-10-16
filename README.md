# SimpRestore

> Created and maintained by **Mohammed Hamed**. AI-assisted / vibe-coded open-source community project.

[Connect with Mohammed on LinkedIn](https://www.linkedin.com/in/mohammed-hamed-2007-space/) · [Support SimpRestore on Ko-fi](https://ko-fi.com/mohammed_hamed01)

**Offline SimpMusic backup recovery, incremental music library, and local audio player for Windows 10/11.**

Created and maintained by **Mohammed Hamed**. This is an independent, AI-assisted / vibe-coded community project. Its purpose is personal-backup recovery, accessibility, and library organization—not encouraging piracy or unauthorized redistribution.

> **Responsible and ethical use:** SimpRestore does not provide music or grant permission to copy it. The author does not encourage piracy, unauthorized downloading, or redistribution. Only recover, convert, or retain media you created, own, or have clear permission to access and keep. If you are unsure whether you have that permission, do not process or share that media. Respect artists and rights holders, applicable laws, and the terms of SimpMusic, YouTube Music, and other services. You are responsible for your use; this notice is not a legal guarantee or a substitute for your own ethical judgement. SimpRestore is independent and not affiliated with or endorsed by SimpMusic, YouTube, or YouTube Music.

## Get the app (recommended)

1. Open this repository's **Releases** page.
2. Download the latest `SimpRestore-<version>-x64.exe` installer. The optional `SimpRestore-Portable-<version>-x64.exe` file does not need installation.
3. Run the installer, choose a destination, and launch SimpRestore.

**Regular users do not need Node.js, Python, PowerShell commands, or a build setup.** Once a maintainer publishes a verified GitHub Release, users can download a Windows installer or portable EXE with Exoprobe and FFmpeg bundled. After installation, recovery and playback work offline. Windows may show an “unknown publisher” warning because community builds are currently unsigned.

The source bundle can be tested through GitHub Actions, but publishing a binary release is intentionally gated until the maintainer verifies the exact FFmpeg binary configuration and corresponding third-party license/source notices. The workflow uploads build artifacts for testing; a maintainer must set the repository variable `ALLOW_RELEASE_PUBLISH=true` after completing that audit to enable automatic GitHub Releases.

## What it does

- Accepts SimpMusic `.backup` files directly. The format is ZIP-compatible; users do not need to rename it to `.zip`.
- Extracts the archive locally with byte-based progress updates and archive path validation.
- Finds `exoplayer_internal.db`, its ExoPlayer cache index, and SimpMusic's `Music Database`.
- Runs the standalone **Exoprobe** utility to rejoin cached media pieces.
- Maps recoverable media IDs to song titles, artists, album names, and durations from the local SimpMusic database.
- Optionally extracts/transcodes recovered audio to MP3 with **FFmpeg**. If conversion fails, the app preserves the recovered source format where possible.
- Supports incremental backups: use the same library folder every time. The local manifest skips known media IDs and adds newly detected tracks without overwriting existing files.
- Includes a local player for restored tracks and supported audio files from any local folder. Existing local music is indexed in place instead of copied.
- Reads local audio tags (title, artist, album, duration) where available and otherwise falls back to a useful filename-derived label.
- Does not upload backups or music, and does not require a SimpMusic or YouTube Music login.

## Create a SimpMusic backup

On the Android phone:

1. Open **SimpMusic** → **Settings**.
2. Scroll down to **Backup**.
3. Select **Backup Your Data / Save all your Playlist data** (wording can vary by version).
4. If available and relevant to your SimpMusic version, enable **Backup downloaded data** so downloaded/cache data is included. A playlist-only backup cannot recreate cache files that are not inside the backup.
5. Transfer the generated `.backup` file to Windows using USB, LocalSend, or another file-transfer method.

Do not rename individual EXO files or edit the backup archive. SimpRestore accepts the `.backup` file as-is.

## Restore your first backup

1. Launch SimpRestore and accept/read the responsible-use notice shown on first launch.
2. Select the `.backup` file.
3. Select a permanent library folder, for example `D:\Music\SimpRestore Library`.
4. Keep **Convert recoverable audio to MP3** enabled for a music-focused library, or turn it off to preserve recovered containers. Enable **Keep recovered originals as well** only if you want the extra space usage.
5. Start recovery and follow the activity log. Archive extraction progress is based on the amount of data processed. Cache joining and audio conversion can still take time depending on the backup size and device performance.
6. Visit **Music library** or **Player** when the run finishes.

## Incremental backups

Example: first backup recovers 1,300 tracks; a later backup contains 1,500.

1. Select the later backup.
2. Choose the **same library folder** used previously.
3. SimpRestore reads `.simprestore-library.json`, compares recovered media IDs, skips tracks already recorded in the manifest, and adds any new IDs it can recover.

Existing library files are never deleted or deliberately overwritten. The manifest is saved after each successfully processed track so an interrupted run can resume without forgetting completed work. It is needed for ID-based de-duplication; keep it in the library folder.

## Play any local music

On **Music library** or **Player**, choose **Add local folder** and select a folder containing audio files. SimpRestore indexes supported local files in place; it does not move or copy them. Track tags are read where possible. The built-in player relies on Electron/Chromium codecs, so support depends on the file format and codec installed with the current runtime. MP3 and common M4A/WebM audio are the safest choices. A player error does not change or damage the original file.

SimpRestore does not sign in to YouTube Music or access an account library. It is an offline backup utility, not a streaming client or downloader. **Noctis** was reviewed as a separate local player, but it is a standalone C#/Avalonia app rather than an embeddable Electron component; its code is not included or copied here. SimpRestore contains a lightweight local player so backup recovery and playback remain in one program.

## Build from source (maintainers only)

The one-time source build downloads npm packages and build tools. End users should not run the build script; they should install the ready-made Windows installer from GitHub Releases once a release has been published.

End users should use the GitHub release binaries above. Developers contributing to this repository can build on Windows 10/11 x64:

1. Install Node.js 22 LTS (includes npm): <https://nodejs.org/>.
2. Extract the repository to a drive with at least **6 GB free** (for example `D:\Projects\SimpRestore`).
3. Run `Build-Windows.bat`.
4. The first build installs npm dependencies and fetches Exoprobe/FFmpeg. It needs internet once. Output files are created in `release/`. npm, Electron, electron-builder and temporary caches are redirected into `.build-cache/` inside the repository instead of using the default npm cache under your Windows user profile. Windows code signing is disabled for this unsigned community build, while executable metadata and icons remain editable; a signing certificate is not required for local builds.

For a clean developer environment:

```powershell
npm install
npm run prepare:tools
npm start
```

To create both distribution formats:

```powershell
npm run dist:win
```

#### Fixing `ENOSPC` / no space left on device

`ENOSPC` means Windows ran out of writable disk space while npm was extracting packages. This is not a SimpRestore backup error. The updated `Build-Windows.bat` checks available space first and places its npm/Electron caches under `.build-cache/` on the repository drive. It stops when less than 6 GB is free.

If your repository is on `C:` and that drive is full, close the build window and move the entire extracted repository to a drive with enough space, then run `Build-Windows.bat` again. Do not move only `node_modules` or `vendor`; move the complete repository folder. You can reclaim build-cache space by closing build processes and deleting `.build-cache/`; the next build will download those items again. Leave personal files and the Windows system folders alone.

## Build and release through GitHub Actions

1. Push the repository to GitHub.
2. Open **Actions → Build Windows app → Run workflow** to build the installer and portable EXE on GitHub. Download the `SimpRestore-Windows-*` artifact from the successful run. Pushes to `main` also start a build automatically.
3. After verifying the exact bundled FFmpeg build and required source/license materials, set the repository variable `ALLOW_RELEASE_PUBLISH=true`. Then push a version tag such as `v0.2.2`; the workflow builds the installer and portable EXE and attaches them to a matching GitHub Release. Without that variable, the workflow only stores build artifacts for testing.

The repository workflow does not need any personal access token; it uses the workflow's `GITHUB_TOKEN` permission to publish releases. Check that repository Actions settings allow release creation.

## Storage requirements and `ENOSPC`

SimpRestore now creates its temporary extraction and Exoprobe rejoin workspace **inside the selected music library folder**, on the same drive as that folder. This avoids silently filling `C:\Users\…\AppData\Local\Temp` when a user selected a library on `D:` or another drive. The app checks the backup's expanded size and the available space before extracting, then converts `ENOSPC` errors into a readable message. Temporary workspace data is removed after the run when Windows allows cleanup.

Large backups may need several times their compressed archive size as free space because the archive is extracted, cached media is rejoined, and exported files are written to the library. Choose a destination folder on a roomy drive, leave the “Keep recovered originals” option off unless needed, and keep at least several GB free. If space is not sufficient, the app stops before extraction and asks you to choose a different library drive.

## Data safety and limitations

- The selected `.backup` file is read-only from the app's point of view. The app extracts it into a private temporary directory on the library drive and removes only that temporary work area after the run.
- Extracted archive paths are checked to prevent writing outside the temporary destination, and archives over the configured safety limits are rejected.
- Recoverability depends on the cache index and media pieces being present and complete. Media already evicted before the backup cannot be reconstructed from a playlist entry alone.
- A matching track title is only used when the local SimpMusic song database contains the same media ID. If no match exists, the app uses a conservative `Track <ID>` fallback instead of guessing.
- Local folders are indexed in place by absolute path. If you move/delete those files later, the manifest entry will no longer play.
- MP3 is lossy. Keep the source files if you want to retain the recovered original quality/container.
- YouTube Music account integration and online downloads are intentionally not included. The tool does not bypass service authentication or download media from streaming services.

## Repository structure

```text
SimpRestore/
├─ src/
│  ├─ main.js                 # ZIP extraction, Exoprobe, metadata mapping, local folder indexing
│  ├─ preload.js              # Narrow, context-isolated IPC bridge
│  ├─ index.html              # English-first UI and first-run responsible-use notice
│  ├─ styles.css              # Local UI styles, no remote assets/fonts
│  └─ renderer.js             # Screens, progress, local library, player
├─ scripts/prepare-tools.js   # Fetches/stages the official Exoprobe/FFmpeg tools
├─ .github/workflows/         # Windows build and GitHub Release automation
├─ Build-Windows.bat          # One-command maintainer build
├─ LICENSE                   # SimpRestore source license
└─ THIRD_PARTY_NOTICES.md     # Required attributions / component license notes
```

## Credits

- **Exoprobe** by Abrignoni — joins cached ExoPlayer pieces and reports recovered media. <https://github.com/abrignoni/exoprobe>
- **FFmpeg** — audio stream extraction and conversion, invoked as a separate executable process. <https://ffmpeg.org/>
- **Electron** — desktop runtime. <https://github.com/electron/electron>
- **yauzl** — streaming ZIP reading and extraction. <https://github.com/thejoshwolfe/yauzl>
- **sql.js** — SQLite database reading. <https://github.com/sql-js/sql.js>
- **music-metadata** — local audio tag parsing. <https://github.com/Borewit/music-metadata>
- **Noctis** was evaluated as a separate open-source local player but is not included in this repository. <https://github.com/heartached/Noctis>

See `THIRD_PARTY_NOTICES.md` for license and redistribution notes. The Windows build records `ffmpeg -version`, `ffmpeg -buildconf`, and `ffmpeg -L` in `FFMPEG-BUILD-INFO.txt`; keep that audit record with the exact release binary.
