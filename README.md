# Scientific Calculator

A natural textbook display scientific calculator with 8 modes, packaged as a desktop app for Windows.
The same files still run as a plain static web page — no build step needed to open `index.html`.

## Download

Grab the newest `.exe` from the [Releases](../../releases/latest) page:

| File | What it is |
| --- | --- |
| `Scientific-Calculator-1.0.0-setup.exe` | Installer — adds Start menu / desktop shortcuts and can be uninstalled from Settings → Apps |
| `Scientific-Calculator-1.0.0-portable.exe` | Single file, nothing installed — just double-click and run |

Both are unsigned, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.

## Features

- **Eight modes** — Calculate, Statistics, Equation, Matrix, Vector, Complex, Base-N, Table
- **Natural display** — expressions and results are typeset with KaTeX as you type
- **Exact forms** — press `S⇔D` to switch between fraction, surd, π and decimal results
- **Equation solver** — Newton iteration with a configurable initial guess and search range
- **Statistics** — one-variable stats plus linear regression, `r`, `r²` and estimates
- **Base-N** — 32-bit integer arithmetic with bitwise `and` / `or` / `xor` / `xnor`
- **Variables** — `A`–`F`, `X`, `Ans`, `MatAns`, `VctAns`, history, constants and unit conversion
- **Keyboard driven** — type expressions directly, `Enter` evaluates, `Esc` clears

## Run from source

```bash
npm install
npm start
```

## Build the Windows executables

```bash
npm install
npm run dist            # installer + portable exe in dist/
npm run dist:installer  # setup exe only
npm run dist:portable   # portable exe only
```

Build output lands in `dist/`. The app icon is generated from `scripts/make-icon.js` into `build/icon.png`
(`node scripts/make-icon.js`) — edit that script to change the artwork.

A GitHub Actions workflow (`.github/workflows/build-windows.yml`) builds both executables on every push
to a `v*` tag and attaches them to the release. You can also run it manually from the Actions tab.

## Project layout

```
main.js                    Electron main process (window, menu, external links)
index.html                 App shell and layout
styles.css                 Design system and responsive layout
engine.js                  math.js setup, evaluation, formatting, solver, statistics
basen.js                   Base-N tokenizer, parser and formatting
app.js                     UI wiring: modes, keypad, history, converters
vendor/                    Bundled math.js 13.2.0 and KaTeX 0.16.11 (works offline)
build/icon.png              App icon source
scripts/make-icon.js       Icon generator (no image dependencies)
scripts/smoke.js           Headless smoke test of the real UI
```

## Notes

- The app makes no network requests. math.js and KaTeX are bundled in `vendor/` instead of loaded from a CDN.
- `scripts/smoke.js` loads `index.html` in Electron, evaluates sample expressions and reports console
  errors: `node_modules/electron/dist/electron.exe scripts/smoke.js`.
- `mathjs`, `katex` and `electron` are dev dependencies: they are only needed to refresh `vendor/`
  and to build the executables.
