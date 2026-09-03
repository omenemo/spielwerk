# spielwerk

Small parametric design tools. Each tool is one self-contained HTML file —
no build, no dependencies, works from `file://` or any static host.

## Adding a tool

1. Drop `your-tool.html` into `tools/`
2. Add one line to the `tools` array in `index.html`

## Hosting

GitHub Pages, from the repo root of `main`. The index reads `tools.json`
and renders the gallery.
