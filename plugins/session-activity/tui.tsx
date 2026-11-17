import { Plugin } from "@opencode/plugin/tui";
import type { SessionMessageInfo } from "@opencode/client";
import { TextRenderable, type Renderable } from "@opentui/core";

/**
 * Put the running turn's current action in the composer's model line:
 *
 *   Build · Thinking… · DeepSeek V4.1 Flash 1017 OpenCode Go · high
 *
 * OpenCode renders that line itself and exposes no slot inside it, so this
 * appends two text nodes after the agent name and removes them again when the
 * turn ends. If the row cannot be found (shell mode, a very narrow terminal,
 * a composer that has not mounted yet), the same word is shown above the prompt
 * through `session.composer.top`.
 */

type Activity = {
  word: string;
};

const textOf = (node: Renderable): string =>
  node instanceof TextRenderable ? String(node.plainText ?? "") : "";

const firstText = (node: Renderable): TextRenderable | undefined => {
  if (node instanceof TextRenderable && textOf(node).trim()) return node;
  for (const child of node.getChildren()) {
    const found = firstText(child);
    if (found) return found;
  }
  return undefined;
};

const findSeparator = (node: Renderable): TextRenderable | undefined => {
  if (node instanceof TextRenderable && textOf(node) === "·") return node;
  for (const child of node.getChildren()) {
    const found = findSeparator(child);
    if (found) return found;
  }
  return undefined;
};

const VERBS: Record<string, string> = {
  bash: "Calling the shell…",
  read: "Skimming…",
  edit: "Editing…",
  write: "Editing…",
  apply_patch: "Patching…",
  grep: "Grepping…",
  glob: "Globbing…",
  list: "Listing…",
  webfetch: "Downloading…",
  websearch: "Searching the web…",
  task: "Delegating…",
  execute: "Running code…",
};

const toolVerb = (name: string) => VERBS[name] ?? "Tinkering…";

const activityOf = (messages: SessionMessageInfo[]): Activity => {
  const start = messages.findLastIndex((message) => message.type === "user");
  let active: string | undefined;
  let last: "text" | "tool" | "reasoning" | undefined;
  let lastDone = true;

  for (const message of messages.slice(start === -1 ? 0 : start)) {
    if (message.type !== "assistant") continue;
    const done = message.time.completed !== undefined;

    for (const part of message.content) {
      if (part.type === "reasoning") {
        last = "reasoning";
        lastDone = done || part.time?.completed !== undefined;
        if (!lastDone) active = "Thinking…";
        continue;
      }
      if (part.type === "text") {
        if (part.text.trim()) {
          last = "text";
          lastDone = done;
        }
        continue;
      }
      if (part.type !== "tool") continue;

      last = "tool";
      lastDone =
        part.state.status !== "streaming" && part.state.status !== "running";
      if (lastDone) continue;
      active = toolVerb(part.name);
    }
  }

  if (active) return { word: active };
  if (last === "text" && !lastDone) return { word: "Composing…" };
  return { word: "Thinking…" };
};

export default Plugin.define({
  id: "local.session-activity",
  setup(context) {
    const [state, update] = context.storage.memory<{ attached: boolean }>(
      "session-activity",
      { initial: { attached: false } },
    );

    let injected:
      | { row: Renderable; separator: TextRenderable; label: TextRenderable }
      | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const activeSession = () => {
      const route = context.ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    };

    const target = () => {
      const editor = context.renderer.currentFocusedEditor;
      if (!editor?.parent) return;

      const siblings = editor.parent.getChildren();
      const after = siblings.slice(siblings.indexOf(editor) + 1);
      for (const sibling of after) {
        const separator = findSeparator(sibling);
        const row = separator?.parent?.parent;
        if (!separator || !row) continue;
        const agent = firstText(row);
        if (!agent?.parent) continue;
        return { row: agent.parent, index: row.getChildren().indexOf(agent) };
      }
    };

    const detach = () => {
      if (!injected) return;
      try {
        injected.row.remove(injected.separator);
        injected.row.remove(injected.label);
        injected.separator.destroy();
        injected.label.destroy();
      } catch {}
      injected = undefined;
    };

    const ensure = () => {
      const found = target();
      if (!found) return false;
      if (
        injected &&
        injected.row === found.row &&
        found.row.getChildren().includes(injected.label)
      )
        return true;

      detach();
      try {
        const separator = new TextRenderable(context.renderer, {
          content: "·",
          fg: context.theme.text.muted,
          wrapMode: "none",
        });
        const label = new TextRenderable(context.renderer, {
          content: "",
          fg: context.theme.text.muted,
          wrapMode: "none",
        });
        found.row.add(separator, found.index + 1);
        found.row.add(label, found.index + 2);
        injected = { row: found.row, separator, label };
        return true;
      } catch {
        detach();
        return false;
      }
    };

    const hide = () => {
      if (!injected) return;
      injected.separator.visible = false;
      injected.label.visible = false;
    };

    const setAttached = (value: boolean) => {
      if (state.attached === value) return;
      update((draft) => {
        draft.attached = value;
      });
    };

    const paint = () => {
      const sessionID = activeSession();
      if (!sessionID) {
        hide();
        setAttached(false);
        return;
      }
      if (context.data.session.status(sessionID) !== "running") {
        hide();
        return;
      }

      const activity = activityOf(context.data.session.message.list(sessionID));
      if (!ensure() || !injected) {
        setAttached(false);
        return;
      }

      setAttached(true);
      injected.separator.visible = true;
      injected.label.visible = true;
      injected.label.content = activity.word;
    };

    const schedule = (delay = 100) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        paint();
      }, delay);
    };

    const stop = context.data.listen(({ details }) => {
      if (details.type === "session.viewed") {
        schedule(0);
        schedule(300);
        return;
      }
      schedule(100);
    });

    // The composer mounts after setup on a restored session; retry once it is
    // there, and again after the first frame has settled.
    schedule(500);
    schedule(1500);

    context.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => {
        if (state.attached) return null;
        if (context.data.session.status(sessionID) !== "running") return null;

        const { word } = activityOf(
          context.data.session.message.list(sessionID),
        );
        return (
          <box paddingLeft={2}>
            <text fg={context.theme.text.faint} wrapMode="none" truncate>
              {word}
            </text>
          </box>
        );
      },
    });

    return () => {
      stop();
      clearTimeout(timer);
      detach();
    };
  },
});
