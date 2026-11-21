import { Plugin } from "@opencode/plugin/tui";
import type { SessionMessageInfo } from "@opencode/client";
import {
  BoxRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  bold,
  t,
  type Renderable,
} from "@opentui/core";

/**
 * A brief for each completed turn, shown below the assistant footer.
 *
 * When a turn ends, the turn's messages are sent to a small, fast model through
 * OpenCode's stateless `generate.text` endpoint, and the answer is appended to
 * the transcript as a wrapping text node, with a composer slot as fallback.
 *
 * The model is the one OpenCode already keeps for short background work:
 * `small_model` from `opencode.json(c)`, which the server exposes as the hidden
 * `title` agent's model. `options.model` (or `OPENCODE_TURN_BRIEF_MODEL`)
 * overrides it, `"default"` uses the session's default model instead, and
 * `"none"` turns the plugin off.
 */

type Outcome = "succeeded" | "failed" | "interrupted";

type Model = {
  providerID: string;
  id: string;
  variant?: string;
};

type Entry = {
  sessionID: string;
  text?: string;
  pending?: boolean;
  error?: string;
};

type State = {
  entries: Entry[];
  attached: boolean;
};

type Generate = {
  text(
    input: { prompt: string; model?: Model | null },
    options?: { signal?: AbortSignal },
  ): Promise<{ text: string }>;
};

type ConfigDocument = {
  info?: {
    small_model?: unknown;
    agents?: Record<string, { model?: unknown } | undefined>;
  };
};

type Selection = Model | "default" | undefined;

const DEFAULT_INSTRUCTION = [
  "You write the brief for a completed coding turn in OpenCode.",
  "Reply in the past tense, in plain prose: one or two sentences, with no Markdown, no quotation marks and no trailing period.",
  "Say what was accomplished and mention a file or command only when it was the point of the turn.",
  "If the turn failed or was interrupted, say that.",
].join(" ");

const env = () => {
  const process = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return process?.env ?? {};
};

const optionString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const parseModel = (value: unknown, variant: unknown): Model | undefined => {
  if (typeof value === "object" && value !== null) {
    const model = value as {
      providerID?: unknown;
      id?: unknown;
      modelID?: unknown;
      model?: unknown;
    };
    const providerID = optionString(model.providerID);
    const id =
      optionString(model.id) ??
      optionString(model.modelID) ??
      optionString(model.model);
    if (providerID && id)
      return {
        providerID,
        id,
        ...(optionString(variant) ? { variant: optionString(variant) } : {}),
      };
    return undefined;
  }

  const text = optionString(value);
  if (!text || text === "default") return undefined;
  const slash = text.indexOf("/");
  if (slash <= 0 || slash === text.length - 1) return undefined;
  return {
    providerID: text.slice(0, slash),
    id: text.slice(slash + 1),
    ...(optionString(variant) ? { variant: optionString(variant) } : {}),
  };
};

const briefText = (text: string, max: number) => {
  let line = text
    .replace(/\s+/g, " ")
    .replace(/^(?:summary|brief)\s*[:\-–]\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

  if (max > 0 && line.length > max)
    line = line.slice(0, max - 1).trimEnd() + "…";
  return line;
};

const shorten = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
};

const TOOL_INPUT_KEYS = [
  "command",
  "filePath",
  "path",
  "pattern",
  "query",
  "url",
  "description",
  "prompt",
  "name",
];

const toolLine = (
  part: Extract<SessionMessageInfo, { type: "assistant" }>["content"][number],
) => {
  if (part.type !== "tool") return undefined;
  const state = part.state;
  const input =
    "input" in state && typeof state.input === "object" && state.input !== null
      ? state.input
      : {};
  const fields = TOOL_INPUT_KEYS.flatMap((key) =>
    key in input ? [`${key}=${shorten(input[key], 120)}`] : [],
  );
  const status = part.state.status === "error" ? " (failed)" : "";
  return `TOOL ${part.name}(${fields.join(", ")})${status}`;
};

const transcriptOf = (messages: SessionMessageInfo[], max: number) => {
  const start = messages.findLastIndex((message) => message.type === "user");
  if (start === -1) return "";

  const blocks: string[] = [];
  for (const message of messages.slice(start)) {
    if (message.type === "user") {
      blocks.push(`USER:\n${shorten(message.text, 1500)}`);
      continue;
    }
    if (message.type !== "assistant") continue;

    for (const part of message.content) {
      const tool = toolLine(part);
      if (tool) blocks.push(tool);
      else if (part.type === "text" && part.text.trim())
        blocks.push(`ASSISTANT:\n${shorten(part.text, 1200)}`);
    }
    if (message.error)
      blocks.push(`ERROR: ${shorten(message.error.message, 300)}`);
  }

  const text = blocks.join("\n\n");
  if (text.length <= max) return text;

  // Keep the request and the end of the turn; the middle is what a summary can
  // afford to lose when a turn was enormous.
  const head = Math.floor(max * 0.4);
  const tail = max - head - 24;
  return `${text.slice(0, head)}\n\n... (truncated) ...\n\n${text.slice(-tail)}`;
};

export default Plugin.define({
  id: "local.turn-brief",
  setup(context) {
    const options = context.options;
    const envVars = env();
    const configuredModel = options.model ?? envVars.OPENCODE_TURN_BRIEF_MODEL;
    const overrideModel = parseModel(configuredModel, options.variant);
    const useDefaultModel = configuredModel === "default";
    const disabled = configuredModel === "none";
    const instruction = optionString(options.prompt) ?? DEFAULT_INSTRUCTION;
    const maxChars =
      typeof options.maxChars === "number" ? options.maxChars : 400;
    const maxTranscript =
      typeof options.maxTranscriptChars === "number"
        ? options.maxTranscriptChars
        : 12000;
    const timeout =
      typeof options.timeout === "number" ? options.timeout : 30_000;

    const [state, update] = context.storage.memory<State>("turn-brief", {
      initial: { entries: [], attached: false },
    });

    const client = context.client as unknown as {
      generate?: Generate;
      experimental?: { generate?: Generate };
      config?: { get(): Promise<ConfigDocument[]> };
      agent?: {
        list(): Promise<{
          data?: { id?: string; model?: unknown }[];
        }>;
      };
    };
    const generate = client.experimental?.generate ?? client.generate;

    // OpenCode resolves the global `small_model` into the hidden `title` agent,
    // so read that instead of keeping a second model setting in cli.json. The
    // config is fetched once per plugin load; a config save reloads plugins.
    let smallModel: Promise<Model | undefined> | undefined;
    const resolveSmallModel = () => {
      smallModel ??= (async () => {
        try {
          const documents = (await client.config?.get()) ?? [];
          // Later documents override earlier ones.
          for (const document of [...documents].reverse()) {
            const info = document.info;
            if (!info) continue;
            const resolved =
              parseModel(info.small_model, options.variant) ??
              parseModel(info.agents?.title?.model, options.variant);
            if (resolved) return resolved;
          }
        } catch {}

        // Older config documents do not expose the derived title agent; ask the
        // server for its resolved agents instead.
        try {
          const agents = await client.agent?.list();
          const title = agents?.data?.find((agent) => agent.id === "title");
          const resolved = parseModel(title?.model, options.variant);
          if (resolved) return resolved;
        } catch {}

        return undefined;
      })();
      return smallModel;
    };

    const selectedModel = async (): Promise<Selection> => {
      if (disabled) return undefined;
      if (overrideModel) return overrideModel;
      if (useDefaultModel) return "default";
      return resolveSmallModel();
    };

    const find = (sessionID: string) =>
      state.entries.findLast((entry) => entry.sessionID === sessionID);

    const put = (sessionID: string, patch: Partial<Entry>) => {
      update((draft) => {
        const index = draft.entries.findLastIndex(
          (entry) => entry.sessionID === sessionID,
        );
        if (index === -1) draft.entries.push({ sessionID, ...patch });
        else draft.entries[index] = { ...draft.entries[index], ...patch };
      });
      paint();
    };

    const clear = (sessionID: string) =>
      put(sessionID, { text: undefined, error: undefined, pending: false });

    // The transcript's scrollbox is host-owned and not part of the plugin API.
    // The only public slot sits below the scrollbox, which leaves the brief at
    // the bottom of an empty area instead of under the assistant footer. With
    // the default "transcript" placement, append a plugin text node to the
    // session scrollbox's content so it sits right after the `Build · ...` row;
    // fall back to the composer slot if the scrollbox cannot be found.
    const placement =
      options.placement === "composer" ? "composer" : "transcript";

    type TranscriptNode = {
      box: BoxRenderable;
      text: TextRenderable;
      scroll: ScrollBoxRenderable;
    };
    let node: TranscriptNode | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const later = (action: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        action();
      }, ms);
      timers.add(timer);
    };

    const activeSession = () => {
      const route = context.ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    };

    const findTranscript = () => {
      const found: ScrollBoxRenderable[] = [];
      const walk = (current: Renderable) => {
        if (current instanceof ScrollBoxRenderable) found.push(current);
        for (const child of current.getChildren()) walk(child);
      };
      walk(context.renderer.root);
      return found.sort(
        (left, right) => right.width * right.height - left.width * left.height,
      )[0];
    };

    const inContent = () => {
      if (!node) return false;
      try {
        return node.scroll.content.getChildren().includes(node.box);
      } catch {
        return false;
      }
    };

    const detach = () => {
      if (!node) return;
      try {
        if (node.scroll.content.getChildren().includes(node.box))
          node.scroll.content.remove(node.box);
      } catch {}
      try {
        node.box.destroy();
      } catch {}
      node = undefined;
    };

    const place = () => {
      if (!node) return;
      try {
        // Keep the brief at the tail of the transcript. Its top margin is the
        // one blank line that separates it from the `Build · ...` footer.
        if (inContent()) node.scroll.content.remove(node.box);
        node.scroll.content.add(node.box);
      } catch {}
    };

    const attach = () => {
      if (node) return true;
      const scroll = findTranscript();
      if (!scroll) return false;
      try {
        const box = new BoxRenderable(context.renderer, {
          paddingLeft: 3,
          marginTop: 1,
          width: "100%",
        });
        const text = new TextRenderable(context.renderer, {
          content: "",
          wrapMode: "word",
          width: "100%",
          fg: context.theme.text.muted,
        });
        box.add(text);
        scroll.content.add(box);
        node = { box, text, scroll };
        place();
        return true;
      } catch {
        return false;
      }
    };

    const setAttached = (value: boolean) => {
      if (state.attached === value) return;
      update((draft) => {
        draft.attached = value;
      });
    };

    const paint = () => {
      if (placement !== "transcript") return;
      const sessionID = activeSession();
      if (!sessionID) {
        if (node) node.box.visible = false;
        setAttached(false);
        return;
      }
      if (node && !inContent()) detach();
      if (!attach() || !node) {
        setAttached(false);
        return;
      }
      setAttached(true);

      const entry = find(sessionID);
      if (!entry || (!entry.pending && !entry.error && !entry.text)) {
        node.box.visible = false;
        return;
      }

      node.box.visible = true;
      place();
      if (entry.pending) {
        node.text.content = t`${bold("Brief:")} summarizing…`;
        node.text.fg = context.theme.text.faint;
      } else if (entry.error) {
        node.text.content = t`${bold("Brief:")} unavailable: ${entry.error}`;
        node.text.fg = context.theme.text.feedback.error.base;
      } else {
        node.text.content = t`${bold("Brief:")} ${entry.text ?? ""}`;
        node.text.fg = context.theme.text.muted;
      }
    };

    const paintLater = () => {
      paint();
      later(paint, 100);
      later(paint, 600);
    };

    // One request at a time per session, and one abort controller each, so a
    // newer turn cannot be annotated by an older, slower summary.
    const requests = new Map<string, { id: number; abort: AbortController }>();
    let sequence = 0;
    let stop: (() => void) | undefined;

    // A failed setup never returns its disposer, and `context.data.listen` is
    // not owned by the host's activation cleanup. A generation that throws
    // after subscribing would therefore outlive its replacement, keep painting
    // the shared memory store and leave one more `Brief:` under the footer for
    // every failed reload. Tear the activation down on both outcomes.
    const dispose = () => {
      stop?.();
      stop = undefined;
      detach();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const request of requests.values()) request.abort.abort();
      requests.clear();
    };

    const summarize = async (sessionID: string, outcome: Outcome) => {
      if (disabled) return;
      if (!generate) {
        put(sessionID, { pending: false, error: "generate.text unavailable" });
        return;
      }

      const selection = await selectedModel();
      // Without an explicit model and without small_model there is nothing to
      // spend money on; the setup toast already explained how to configure one.
      if (!selection) return;

      await context.data.session.message.sync(sessionID);
      const transcript = transcriptOf(
        context.data.session.message.list(sessionID),
        maxTranscript,
      );
      if (!transcript) {
        clear(sessionID);
        return;
      }

      const id = ++sequence;
      requests.get(sessionID)?.abort.abort();
      const abort = new AbortController();
      requests.set(sessionID, { id, abort });
      put(sessionID, { pending: true, error: undefined });

      const timer = setTimeout(() => abort.abort(), timeout);
      try {
        const prompt = [
          instruction,
          ...(maxChars > 0 ? [`At most ${maxChars} characters.`] : []),
          `The turn ended as: ${outcome}.`,
          "",
          "Turn transcript:",
          transcript,
        ].join("\n");

        const result = await generate.text(
          {
            prompt,
            model: selection === "default" ? undefined : selection,
          },
          { signal: abort.signal },
        );
        if (requests.get(sessionID)?.id !== id) return;

        const brief = briefText(result.text, maxChars);
        if (brief)
          put(sessionID, { text: brief, pending: false, error: undefined });
        else put(sessionID, { pending: false, error: "empty summary" });
      } catch (error) {
        if (requests.get(sessionID)?.id !== id) return;
        const message = error instanceof Error ? error.message : String(error);
        put(sessionID, { pending: false, error: briefText(message, 80) });
      } finally {
        clearTimeout(timer);
        if (requests.get(sessionID)?.id === id) requests.delete(sessionID);
      }
    };

    stop = context.data.listen(({ details }) => {
      if (details.type === "session.viewed") {
        paintLater();
        return;
      }

      if (details.type === "session.execution.started") {
        clear(details.data.sessionID);
        return;
      }

      if (
        details.type !== "session.execution.succeeded" &&
        details.type !== "session.execution.failed" &&
        details.type !== "session.execution.interrupted"
      ) {
        return;
      }

      const outcome: Outcome =
        details.type === "session.execution.succeeded"
          ? "succeeded"
          : details.type === "session.execution.failed"
            ? "failed"
            : "interrupted";

      const { sessionID } = details.data;
      // Subagent turns are reflected in the parent transcript as tool calls;
      // summarizing each of them separately would only add cost and noise.
      if (
        options.subagents !== true &&
        context.data.session.root(sessionID) !== sessionID
      )
        return;

      void summarize(sessionID, outcome).catch((error: unknown) => {
        put(sessionID, {
          pending: false,
          error: briefText(
            error instanceof Error ? error.message : String(error),
            80,
          ),
        });
      });
    });

    try {
      if (!disabled && !overrideModel && !useDefaultModel) {
        void resolveSmallModel().then((resolved) => {
          if (resolved) return;
          context.ui.toast.show({
            title: "Turn brief",
            message:
              "No model configured. Set small_model in opencode.json, or options.model in cli.json.",
            variant: "warning",
          });
        });
      }

      context.ui.slot({
        append: "session.composer.top",
        render: ({ sessionID }) => {
          if (state.attached) return null;

          const entry = find(sessionID);
          if (!entry) return null;

          if (entry.pending)
            return (
              <box paddingLeft={2}>
                <text fg={context.theme.text.faint} wrapMode="word">
                  <b>Brief:</b> summarizing…
                </text>
              </box>
            );

          if (entry.error)
            return (
              <box paddingLeft={2}>
                <text
                  fg={context.theme.text.feedback.error.base}
                  wrapMode="word"
                >
                  <b>Brief:</b> unavailable: {entry.error}
                </text>
              </box>
            );

          if (!entry.text) return null;

          return (
            <box paddingLeft={2}>
              <text fg={context.theme.text.muted} wrapMode="word">
                <b>Brief:</b> {entry.text}
              </text>
            </box>
          );
        },
      });

      paintLater();
    } catch (error) {
      dispose();
      throw error;
    }

    return dispose;
  },
});
