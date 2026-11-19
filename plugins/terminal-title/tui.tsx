import { Plugin } from "@opencode/plugin/tui";
import type { SessionMessageInfo } from "@opencode/client";

/**
 * A rolling session summary in the terminal title.
 *
 * When a turn ends, one model call receives the previous session summary and
 * the completed turn, and returns an updated whole-session summary plus a very
 * short title. The title is written through OpenTUI's renderer, which emits the
 * terminal title escape sequence for the host terminal.
 *
 * No model is configured by default. Without `options.model` (or
 * `OPENCODE_TERMINAL_TITLE_MODEL`) the plugin makes no calls and leaves the
 * title alone, so linking it does not silently spend money on every turn.
 */

type Outcome = "succeeded" | "failed" | "interrupted";

type Model = {
  providerID: string;
  id: string;
  variant?: string;
};

type Entry = {
  sessionID: string;
  summary: string;
  title: string;
};

type State = {
  entries: Entry[];
};

type Generate = {
  text(
    input: { prompt: string; model?: Model | null },
    options?: { signal?: AbortSignal },
  ): Promise<{ text: string }>;
};

const DEFAULT_INSTRUCTION = [
  "You maintain a rolling summary and a terminal title for one OpenCode session.",
  "The summary is the session's memory: merge the latest turn into what came before and describe the whole session at a high level, not only the newest turn.",
  "Keep earlier work that still matters and drop detail that does not change the picture.",
  "The title is for a terminal tab: one short phrase or sentence fragment about the whole session, not only the newest turn.",
  "Use plain prose with no Markdown, no quotation marks and no trailing period.",
].join(" ");

const env = () => {
  const process = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return process?.env ?? {};
};

const optionString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberOption = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const parseModel = (value: unknown, variant: unknown): Model | undefined => {
  if (typeof value === "object" && value !== null) {
    const model = value as {
      providerID?: unknown;
      id?: unknown;
      modelID?: unknown;
    };
    const providerID = optionString(model.providerID);
    const id = optionString(model.id) ?? optionString(model.modelID);
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

// Terminal titles are one line and must not contain escape sequences. Keep all
// printable text, including non-ASCII, but turn every control character into a
// space before collapsing the whitespace.
const stripControls = (text: string) =>
  // eslint-disable-next-line no-control-regex -- control characters are exactly what must not reach the title.
  text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ");

const singleLine = (text: string) =>
  stripControls(text).replace(/\s+/g, " ").trim();

const titleOf = (text: string, max: number) => {
  let line = singleLine(text)
    .replace(/^[*_`#\s]+/, "")
    .replace(/^(?:title|session\s+title)\s*[:\-–]\s*/i, "")
    .replace(/^["'`*_#\s]+|["'`*_#\s]+$/g, "")
    .replace(/\.+$/, "")
    .trim();

  if (max > 0 && line.length > max)
    line = line.slice(0, max - 1).trimEnd() + "…";
  return line;
};

const summaryOf = (text: string, max: number) => {
  let line = singleLine(text);
  if (max > 0 && line.length > max)
    line = line.slice(0, max - 1).trimEnd() + "…";
  return line;
};

const TITLE_LABEL = /^[\s*_`#]*title\s*[*_`#]*\s*[:\-–]\s*(.*)$/i;
const SUMMARY_LABEL = /^[\s*_`#]*summary\s*[*_`#]*\s*[:\-–]\s*(.*)$/i;

/**
 * Read the model's `TITLE:` and `SUMMARY:` reply. A model that ignores the
 * labels still gets a usable title: its first line becomes the title and the
 * rest becomes the summary.
 */
const parseReply = (text: string) => {
  const lines = text.split(/\r?\n/);
  const before: string[] = [];
  const titleParts: string[] = [];
  const summaryParts: string[] = [];
  let mode: "before" | "title" | "summary" = "before";

  for (const raw of lines) {
    const line = raw.trim();
    const title = TITLE_LABEL.exec(line);
    if (title) {
      mode = "title";
      if (title[1].trim()) titleParts.push(title[1].trim());
      continue;
    }

    const summary = SUMMARY_LABEL.exec(line);
    if (summary) {
      mode = "summary";
      if (summary[1].trim()) summaryParts.push(summary[1].trim());
      continue;
    }

    if (mode === "title") {
      if (line) titleParts.push(line);
    } else if (mode === "summary") {
      summaryParts.push(raw);
    } else if (line) {
      before.push(line);
    }
  }

  let title = titleParts.join(" ").trim();
  let summary = summaryParts.join("\n").trim();

  if (!title && before.length) {
    title = before[0];
    if (!summary && before.length > 1) summary = before.slice(1).join("\n");
  }
  if (!title && summary) title = summary.split(/[.!?]\s/)[0] ?? summary;

  return { title, summary };
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

  // Keep the request and the end of the turn; the middle is what the summary
  // can afford to lose when a turn was enormous.
  const head = Math.floor(max * 0.4);
  const tail = max - head - 24;
  return `${text.slice(0, head)}\n\n... (truncated) ...\n\n${text.slice(-tail)}`;
};

export default Plugin.define({
  id: "local.terminal-title",
  setup(context) {
    const options = context.options;
    const envVars = env();
    const model = parseModel(
      options.model ?? envVars.OPENCODE_TERMINAL_TITLE_MODEL,
      options.variant,
    );
    const configured =
      Boolean(model) ||
      options.model === "default" ||
      envVars.OPENCODE_TERMINAL_TITLE_MODEL === "default";
    const instruction = optionString(options.prompt) ?? DEFAULT_INSTRUCTION;
    const maxTitle = numberOption(options.maxTitleChars, 60);
    const maxSummary = numberOption(options.maxSummaryChars, 600);
    const maxTranscript = numberOption(options.maxTranscriptChars, 12000);
    const timeout = numberOption(options.timeout, 30_000);

    const [state, update] = context.storage.memory<State>("terminal-title", {
      initial: { entries: [] },
    });

    const client = context.client as unknown as {
      generate?: Generate;
      experimental?: { generate?: Generate };
    };
    const generate = client.experimental?.generate ?? client.generate;

    const find = (sessionID: string) =>
      state.entries.findLast((entry) => entry.sessionID === sessionID);

    const put = (sessionID: string, patch: Partial<Entry>) => {
      update((draft) => {
        const index = draft.entries.findLastIndex(
          (entry) => entry.sessionID === sessionID,
        );
        if (index === -1) {
          draft.entries.push({ sessionID, summary: "", title: "", ...patch });
        } else {
          draft.entries[index] = { ...draft.entries[index], ...patch };
        }
        // Keep the memory bounded when a long-lived TUI visits many sessions.
        if (draft.entries.length > 50)
          draft.entries.splice(0, draft.entries.length - 50);
      });
    };

    const activeSession = () => {
      const route = context.ui.router.current();
      return route.type === "session" ? route.sessionID : undefined;
    };

    const applyTitle = (title: string) => {
      if (!title) return;
      try {
        context.renderer.setTerminalTitle(title);
      } catch {
        // A destroyed renderer at shutdown must not break the turn.
      }
    };

    let warned = false;
    const warn = (message: string) => {
      if (warned) return;
      warned = true;
      context.ui.toast.show({
        title: "Terminal title",
        message,
        variant: "warning",
      });
    };

    // One request at a time per session. A turn that ends while this session's
    // previous summary is still in flight is ignored rather than stacked.
    const requests = new Map<string, AbortController>();

    const summarize = async (sessionID: string, outcome: Outcome) => {
      if (!configured || requests.has(sessionID)) return;
      if (!generate) {
        warn(
          "generate.text is unavailable. The terminal title is left unchanged.",
        );
        return;
      }

      const abort = new AbortController();
      requests.set(sessionID, abort);
      const timer = setTimeout(() => abort.abort(), timeout);

      try {
        await context.data.session.message.sync(sessionID);
        const messages = context.data.session.message.list(sessionID);
        const transcript = transcriptOf(messages, maxTranscript);
        if (!transcript) return;

        const previous = find(sessionID);
        const prompt = [
          instruction,
          `Keep the summary under ${maxSummary} characters.`,
          `Keep the title under ${maxTitle} characters.`,
          `The latest turn ended as: ${outcome}.`,
          "",
          "Previous session summary:",
          previous?.summary || "(none; this is the first completed turn)",
          "",
          "Latest turn transcript:",
          transcript,
          "",
          "Reply in exactly this format and nothing else:",
          "TITLE: <title>",
          "SUMMARY: <summary>",
        ].join("\n");

        const result = await generate.text(
          { prompt, model },
          { signal: abort.signal },
        );
        if (requests.get(sessionID) !== abort) return;

        const parsed = parseReply(result.text);
        const title = titleOf(parsed.title, maxTitle);
        const summary = summaryOf(parsed.summary, maxSummary);

        if (!title) {
          if (summary) put(sessionID, { summary });
          return;
        }

        put(sessionID, {
          summary: summary || previous?.summary || "",
          title,
        });
        if (activeSession() === sessionID) applyTitle(title);
      } catch {
        // Model and network failures leave the last good summary and title in
        // place; the TUI must never see an unhandled rejection from this hook.
      } finally {
        clearTimeout(timer);
        if (requests.get(sessionID) === abort) requests.delete(sessionID);
      }
    };

    const stop = context.data.listen(({ details }) => {
      if (details.type === "session.viewed") {
        const entry = find(details.data.sessionID);
        if (entry?.title) applyTitle(entry.title);
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
      // Subagent turns already appear in the parent transcript as tool calls.
      if (context.data.session.root(sessionID) !== sessionID) return;

      void summarize(sessionID, outcome).catch(() => {});
    });

    if (!configured) {
      warn(
        "No model configured. Set options.model to provider/model in cli.json.",
      );
    }

    return () => {
      stop();
      for (const request of requests.values()) request.abort();
      requests.clear();
    };
  },
});
