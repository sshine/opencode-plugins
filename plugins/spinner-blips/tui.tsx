import { Plugin } from "@opencode/plugin/tui";
import { RGBA, TextRenderable, type Renderable } from "@opentui/core";

/**
 * OpenCode's Knight Rider footer spinner, with three sweeps per direction.
 *
 * The built-in animation is one blip with a fading trail crossing an eight-cell
 * strip, turning around once at each edge. This keeps the same strip, glyphs,
 * trail length and 40 ms frame rate, but makes the blip sweep left three times,
 * then right three times. After the head reaches an edge the trail is allowed
 * to run off the strip before the next sweep starts, so every pass reads as a
 * complete scene rather than a tail that flips sides. The palette is a red
 * gradient instead of the theme accent.
 *
 * The prompt spinner is found by the `esc interrupt` label it sits beside, so
 * the home screen's own spinner is left untouched.
 */

const WIDTH = 8;
const TRAIL = 6;
const BLANK = 2;
const CYCLE_HOLD = 4;
const SWEEPS = 3;

const TRAIL_COLORS = [
  "#ff4d3d",
  "#ff6b5a",
  "#dc3a2c",
  "#b02c23",
  "#7d1e18",
  "#4a110d",
].map((color) => RGBA.fromHex(color));
const INACTIVE = RGBA.fromHex("#3b0f0c");

type State = {
  head: number;
  direction: 1 | -1;
};

const render = (head: number, direction: 1 | -1) => {
  const cells = Array.from({ length: WIDTH }, () => "⬝");
  for (let distance = 0; distance < TRAIL; distance++) {
    const position = head - direction * distance;
    if (position >= 0 && position < WIDTH) cells[position] = "■";
  }
  return cells.join("");
};

const states: State[] = [];
const frames: string[] = [];

const push = (head: number, direction: 1 | -1) => {
  states.push({ head, direction });
  frames.push(render(head, direction));
};

const sweep = (direction: 1 | -1) => {
  const positions = Array.from({ length: WIDTH }, (_, index) => index);
  if (direction === -1) positions.reverse();
  for (const head of positions) push(head, direction);

  // The head keeps moving past the edge immediately, so the tail drains
  // continuously instead of stopping at the edge and then leaving. Once the
  // TRAIL is entirely off the strip, rest blank before the next scene.
  for (let step = 1; step <= TRAIL; step++)
    push(direction === -1 ? -step : WIDTH - 1 + step, direction);
  const off = direction === -1 ? -TRAIL : WIDTH - 1 + TRAIL;
  for (let index = 0; index < BLANK; index++) push(off, direction);
};

// Three passes left, then three right. The last right sweep exits to the
// right; the cycle hold keeps the strip blank there until the next left pass.
for (let pass = 0; pass < SWEEPS; pass++) sweep(-1);
for (let pass = 0; pass < SWEEPS; pass++) sweep(1);
for (let index = 0; index < CYCLE_HOLD; index++) push(WIDTH - 1 + TRAIL, 1);

const isSpinner = (node: Renderable) => {
  const value = node as unknown as Record<string, unknown>;
  return "frames" in value && "interval" in value && "autoplay" in value;
};

const plainText = (node: Renderable) =>
  node instanceof TextRenderable ? String(node.plainText ?? "") : "";

const findSpinner = (node: Renderable): Renderable | undefined => {
  if (isSpinner(node)) return node;
  for (const child of node.getChildren()) {
    const found = findSpinner(child);
    if (found) return found;
  }
  return undefined;
};

const findInterruptLabel = (
  node: Renderable,
  minY: number,
): Renderable | undefined => {
  const value = node as unknown as { screenY?: number; y?: number };
  const y = value.screenY ?? value.y ?? 0;
  if (y >= minY && /interrupt/i.test(plainText(node))) return node;
  for (const child of node.getChildren()) {
    const found = findInterruptLabel(child, minY);
    if (found) return found;
  }
  return undefined;
};

type FooterSpinner = Renderable & {
  frames: string[];
  interval: number;
  color: unknown;
};

export default Plugin.define({
  id: "local.spinner-blips",
  setup(context) {
    let timer: ReturnType<typeof setInterval> | undefined;

    const apply = () => {
      const label = findInterruptLabel(
        context.renderer.root,
        context.renderer.height - 3,
      );
      if (!label) return;

      let scope: Renderable | undefined = label;
      let spinner: Renderable | undefined;
      for (let level = 0; level < 4 && scope && !spinner; level++) {
        spinner = findSpinner(scope);
        if (!spinner) scope = scope.parent ?? undefined;
      }
      if (!spinner) return;

      const color = (frameIndex: number, charIndex: number) => {
        const state = states[frameIndex % states.length];
        if (state) {
          for (let distance = 0; distance < TRAIL; distance++) {
            const position = state.head - state.direction * distance;
            if (position === charIndex)
              return TRAIL_COLORS[distance] ?? INACTIVE;
          }
        }
        return INACTIVE;
      };

      const found = spinner as FooterSpinner;
      try {
        found.frames = frames;
        found.interval = 40;
        found.color = color;
      } catch {}
    };

    timer = setInterval(apply, 200);
    apply();

    const stop = context.data.listen(({ details }) => {
      if (
        details.type === "session.execution.started" ||
        details.type === "session.viewed"
      ) {
        apply();
        setTimeout(apply, 50);
        setTimeout(apply, 200);
      }
    });

    return () => {
      stop();
      clearInterval(timer);
    };
  },
});
