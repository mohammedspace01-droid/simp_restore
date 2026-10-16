# Maintainer release checklist

Before publishing a public binary release:

- [ ] Run the Windows workflow and download its artifact.
- [ ] Test a real SimpMusic `.backup` file with media cache data included.
- [ ] Test a second backup into the same library and confirm only new media IDs are added.
- [ ] Test low-disk-space handling and paths containing spaces/non-ASCII characters.
- [ ] Test playback of restored MP3/M4A/WebM and a folder of existing local files.
- [ ] Audit the exact FFmpeg executable's `-version`, `-buildconf`, and `-L` output.
- [ ] Provide the required FFmpeg source/build materials and license notices for the exact binary.
- [ ] Review `THIRD_PARTY_NOTICES.md` and all dependency licenses.
- [ ] Update `package.json`, `CHANGELOG.md`, and `CITATION.cff` version fields together.
- [ ] Only after the audit, set repository variable `ALLOW_RELEASE_PUBLISH=true` and push a `v*` tag.
- [ ] Verify the published installer and portable build on a clean Windows account.

Do not call a build stable merely because packaging succeeded.
