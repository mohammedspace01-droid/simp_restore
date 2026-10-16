# Third-party notices

SimpRestore is an independent project created and maintained by Mohammed Hamed with AI-assisted / vibe-coded development. Third-party components remain the property of their respective authors and are distributed under their own terms.

## Exoprobe

SimpRestore invokes the standalone Windows executable from **abrignoni/exoprobe**, an open-source tool that rejoins Android ExoPlayer cache media. It is fetched during maintainer builds from the official upstream release page:

- Project: <https://github.com/abrignoni/exoprobe>
- Releases: <https://github.com/abrignoni/exoprobe/releases>
- License: MIT — <https://github.com/abrignoni/exoprobe/blob/main/LICENSE>

The release archive's upstream README, license, and checksum files should be retained in the packaged resource folder when available.

## FFmpeg / ffmpeg-static

FFmpeg is invoked as a separate executable process for audio extraction/conversion; it is not linked into SimpRestore. This project stages the executable supplied by **ffmpeg-static**:

- Wrapper package/source and declared license: <https://github.com/eugeneware/ffmpeg-static>
- FFmpeg licensing: <https://ffmpeg.org/legal.html>
- FFmpeg source code: <https://ffmpeg.org/download.html>
- Package license: GPL-3.0-or-later according to the `ffmpeg-static` project metadata.

When redistributing a build, retain the exact FFmpeg version/source, build configuration, and all license materials provided by the binary package. FFmpeg build options can change the applicable license. The current workflow therefore gates public release publishing behind `ALLOW_RELEASE_PUBLISH=true`; do not enable the gate until the precise bundled binary has been audited and its corresponding source/build information and required notices are made available alongside the release. Maintainers should record `ffmpeg -version`, `ffmpeg -buildconf`, and `ffmpeg -L` output for the exact executable they ship.

## Electron

Electron desktop runtime: <https://github.com/electron/electron>. License and third-party notices: <https://github.com/electron/electron/blob/main/LICENSE> and the Electron distribution's `LICENSES.chromium.html` where provided.

## yauzl

ZIP reading/extraction: <https://github.com/thejoshwolfe/yauzl>. License: MIT, available in package metadata/source.

## sql.js

SQLite/WASM database reading: <https://github.com/sql-js/sql.js>. License: MIT, available in package metadata/source.

## music-metadata

Local audio metadata parsing: <https://github.com/Borewit/music-metadata>. License: MIT, available in package metadata/source.

## Noctis

Noctis (<https://github.com/heartached/Noctis>) was reviewed as a separate local player and is not bundled, linked, or copied into SimpRestore. Upstream license: MIT. It is acknowledged here for transparency only.

## Other npm dependencies

The npm package manager installs transitive dependencies as declared in `package.json`. Maintainers should regenerate dependency/license reports when dependencies change and review licenses for the exact release bundle before publishing. Do not remove upstream license notices from redistributed components.

## Project maintainer

- Maintainer: Mohammed Hamed
- LinkedIn: <https://www.linkedin.com/in/mohammed-hamed-2007-space/>
- Optional project support: <https://ko-fi.com/mohammed_hamed01>
