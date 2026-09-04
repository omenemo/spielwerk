# spielwerk

Small parametric design tools. Each tool is one self-contained HTML file —
no build, no dependencies, works from `file://` or any static host.

## Adding a tool

1. Drop `your-tool.html` into `tools/`
2. Add one line to the `tools` array in `index.html`
3. Keep the `<meta name="viewport">` + `<link rel="stylesheet" href="mobile.css">`
   pair after the inline `<style>` — that is the whole phone layout, and it
   assumes the usual `#panel` / `#stage` / `#viewbox` structure.

## Hosting

GitHub Pages, from the repo root of `main`. The index lists tools from
its inline manifest.
