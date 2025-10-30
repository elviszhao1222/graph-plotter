# Graph Plotter (Desmos-like minimal clone)

A minimal, zero-build web app to plot functions like sin(x) using a canvas. Includes panning (drag) and zooming (scroll).

## Run

- Option 1: Just open index.html in your browser.
- Option 2 (recommended): Serve locally to avoid file URL restrictions.

`
python -m http.server 5173
# Then open http://localhost:5173
`

## Usage

- Enter a function in the (x) input. Examples:
  - sin(x)
  - x^3 - 4*x
  - exp(-x^2/4) * sin(5*x)
- Adjust x min and x max to set the horizontal domain.
- Scroll to zoom at cursor. Drag to pan.

math parsing powered by math.js via CDN.
