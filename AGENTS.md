# Agent notes

## TUI plugin teardown

`context.data.on` / `context.data.listen` are **not** cleaned up by OpenCode when
`setup` throws (unlike slots, keymap layers and panels, which the host owns). A
plugin that throws after subscribing leaves a live generation behind. It shares
`storage.memory` with its replacement, keeps painting duplicate UI (for example
repeated `Brief:` rows) and keeps reacting to events.

Never let `setup` throw after registering anything. Create one disposer, use it
on both paths, and return it:

```ts
let stop: (() => void) | undefined;
const dispose = () => {
  stop?.();
  stop = undefined;
  // also detach renderables, clear timers, abort requests
};
try {
  stop = context.data.listen(handler);
  // remainder of setup
} catch (error) {
  dispose();
  throw error;
}
return dispose;
```

`/reload` cannot evict a generation that already leaked; the TUI must be
restarted.
