# Security Policy

## Reporting a concern

Please do not publish private backup files, authentication data, or personal music-library databases in public issues. Open a private security advisory through GitHub once the repository has been published, or contact the repository maintainer through the contact method listed in the GitHub profile.

## Privacy model

SimpRestore is designed to process backups and media locally. It does not intentionally upload backup contents or music to a server. Build tools download software dependencies and official Exoprobe/FFmpeg components during setup; the packaged app can recover and play supported files offline.

## Safe handling

- Keep original `.backup` files untouched.
- Treat `report.json` and extracted metadata as potentially sensitive.
- Use only backups and media you are authorized to access.
- If you suspect a corrupt or malicious archive, do not process it; archive extraction checks paths and applies entry/expanded-size limits, but no parser can promise protection from every malformed file.
