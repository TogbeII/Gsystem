# Project Rules and Instructions

## Standalone Executable (setup.bat)
- This project uses a standalone Windows `.exe` build process via `pkg`.
- Any changes to the application (new dependencies, new assets, or changes to the build process) **MUST** be reflected in the code and, if necessary, the `setup.bat` file.
- The `setup.bat` file is the primary way the user builds the application for offline use.
- Ensure `package.json`'s `pkg` configuration stays updated with any new required assets (e.g. databases, images, config files).
- Keep the standalone build process optimized and ensure the virtual filesystem mapping in `server.ts` is correct for `pkg`.
