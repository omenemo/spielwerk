# spielwerk

Small parametric design tools. Each tool is one self-contained HTML file —
no build, no dependencies, works from `file://` or any static host.

## Adding a tool

1. Drop `your-tool.html` into `tools/`
2. Add one line to the `tools` array in `index.html`
3. Keep the `<meta name="viewport">` + `<link rel="stylesheet" href="mobile.css">`
   pair after the inline `<style>`, and `<script src="mobile.js">` with the
   other scripts — that is the whole phone layout (artboard on top, controls
   in a sheet that opens when the `<h1>` is tapped). It assumes the usual
   `#panel` > `h1` / `#stage` / `#viewbox` structure.

## Hosting

GitHub Pages, from the repo root of `main`. The index lists tools from
its inline manifest.
