# Parser DOX

## Purpose

`Parser/` owns the standalone web data extractor, its launcher GUI, macOS command wrappers, and packaging artifacts.

## Ownership

- `scripts/web_data_extractor.py` owns extraction behavior.
- `scripts/launcher_gui.py` owns the launcher UI.
- `scripts/*.spec` owns PyInstaller packaging configuration.
- `Parser-mac.command` and `Build-Parser-mac-app.command` own macOS launch/build entry points.
- `build/`, `dist/`, and `.venv-mac/` are generated/runtime artifacts, not primary source.

## Local Contracts

- Keep source changes in `scripts/` or command/spec files; avoid editing generated package outputs unless rebuilding is the explicit task.
- Keep parser dependencies in `scripts/requirements.txt`.
- Treat scraped/exported data as sensitive when it contains candidate or client information.

## Work Guidance

- For extractor behavior, inspect `scripts/web_data_extractor.py` before launcher or packaging files.
- For macOS app issues, inspect the command wrapper and PyInstaller spec together.

## Verification

- No dedicated parser test command is documented yet. For parser changes, run the relevant script or launcher command locally when feasible.

## Child DOX Index

This parser area is not yet split into deeper DOX children.
