# Project Rules and Instructions

## Standalone Executable (setup.bat)
- This project uses a standalone Windows `.exe` build process via `pkg`.
- Any changes to the application (new dependencies, new assets, or changes to the build process) **MUST** be reflected in the code and, if necessary, the `setup.bat` file.
- The `setup.bat` file is the primary way the user builds the application for offline use.
- Ensure `package.json`'s `pkg` configuration stays updated with any new required assets (e.g. databases, images, config files).
- Keep the standalone build process optimized and ensure the virtual filesystem mapping in `server.ts` is correct for `pkg`.

## Version Control & Rollback Safeguards
- A Git repository is initialized in the workspace to safeguard against regressions.
- **Pre-Change Commit**: Before introducing major or breaking features, commit the working tree with a descriptive message or tag so changes can be reverted cleanly.
- **Rollback on Demand**: If a feature causes bugs, data conflicts, or breaks existing functionality, immediately provide a rollback option or revert to the last stable commit/tag upon the user's request.
- **Stable Checkpoints**: The tag `v1.0-stable-isolated` represents the baseline verified state where multi-tenant data separation and isolated Genesys Owner spaces are fully tested and functional.

