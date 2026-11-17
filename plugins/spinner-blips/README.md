# Spinner blips

A variation of OpenCode’s Knight Rider footer spinner: the same single blip and
fading trail on the same eight-cell strip, but the blip sweeps **three times
left, then three times right**, in a red gradient rather than the theme accent.

```text
⬝⬝⬝⬝⬝⬝■■   esc interrupt …
⬝⬝⬝■■⬝⬝⬝⬝   esc interrupt …
⬝⬝⬝⬝⬝⬝⬝⬝   esc interrupt …      ← the tail has left before the next pass
```

- It keeps the built-in strip width, `■`/`⬝` glyphs, trail length and 40 ms frame
  rate. The only changes are the sweep order and the palette.
- Every pass reaches the edge and the head continues straight past it, so the
  **tail drains continuously** without a pause at the edge. Once the tail is
  gone, the strip rests blank for two frames before the next scene.
- Three complete left passes, then three complete right passes. The cycle hold
  is blank at the right edge, and the next left pass starts there.
- The trail is a fixed red gradient: bright red at the head, darker reds behind,
  and dark red inactive dots.

## Caveats

The spinner is a host renderable, not a plugin API. The plugin finds the prompt
spinner by the `esc interrupt` label beside it and leaves the home screen’s
spinner alone. It re-applies the frames and colour every 200 ms and after
execution/view events in case the prompt re-renders the host values.

The red palette is intentionally independent of the theme. If OpenCode changes
the spinner renderable, the plugin stops applying cleanly and the stock
animation returns.
