# Contributing to SimpRestore

Thanks for considering a contribution. SimpRestore is an independent, AI-assisted project maintained by Mohammed Hamed. Contributions should improve personal-backup recovery, reliability, accessibility, documentation, privacy, or local-library usability.

## Before opening an issue

- Search existing issues first.
- Include the app version, Windows version, and the exact stage where the issue happened.
- Share relevant error text and a sanitized `report.json` excerpt when needed.
- **Never upload a private music backup, full media files, signed streaming URLs, or personal database contents to a public issue.**

## Development setup

1. Use Windows 10/11 x64 and Node.js 22 LTS.
2. Run `npm install`.
3. Run `npm run prepare:tools` to fetch and stage the official Exoprobe and FFmpeg binaries. This step needs internet access.
4. Run `npm start` to launch the app.
5. Run `npx electron-builder --win nsis portable --publish never` to build locally.

The GitHub Actions workflow can also build and publish the Windows installer and portable app when a `v*` tag is pushed. Do not commit downloaded binaries, generated installers, `node_modules`, private backups, or music files.

## Contribution expectations

- Keep recovery and local playback offline-first.
- Do not add code that bypasses streaming-service authentication, DRM, paywalls, or access controls.
- Preserve source backups and existing library files; prefer non-destructive operations.
- Include clear error states and progress for long operations.
- Add or update documentation and third-party attribution when introducing dependencies.
- Test that new ZIP handling does not allow path traversal outside the temporary folder.

By submitting a contribution, you agree that the contribution may be distributed under the repository's MIT license, except for third-party materials that remain under their respective licenses.

## Release publishing gate

The workflow intentionally does not publish a GitHub Release unless the repository variable `ALLOW_RELEASE_PUBLISH` is exactly `true`. Before enabling it, verify the version/configuration of the FFmpeg binary being packaged and attach the corresponding source and licensing materials required by that binary. A workflow run can still upload a temporary build artifact for testing while release publishing remains disabled.
