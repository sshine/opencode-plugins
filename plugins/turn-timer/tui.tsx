import { Plugin } from "@opencode/plugin/tui";

/**
 * A live timer for the turn in progress, and how long it took when it ends.
 *
 * A turn begins with `session.execution.started` and ends with `succeeded`,
 * `failed` or `interrupted`. While it runs, the prompt footer counts up; when it
 * ends, the timer stops and the footer keeps the final duration as `⏱ ...`.
 *
 * State lives in `storage.memory`, which is reactive and survives plugin hot
 * reloads, so `/reload` in the middle of a turn does not restart the clock.
 */

type Outcome = "succeeded" | "failed" | "interrupted";

type Turn = {
  sessionID: string;
  startedAt: number;
  endedAt?: number;
  outcome?: Outcome;
};

type State = {
  now: number;
  turns: Turn[];
};

/** 12s, 2m 05s, 1h 02m: zero units are dropped, smaller ones padded. */
const duration = (milliseconds: number) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(hours > 0 ? `${pad(minutes)}m` : `${minutes}m`);
  if (seconds > 0)
    parts.push(parts.length > 0 ? `${pad(seconds)}s` : `${seconds}s`);
  return parts.length > 0 ? parts.join(" ") : "0s";
};

export default Plugin.define({
  id: "local.turn-timer",
  setup(context) {
    const [state, update] = context.storage.memory<State>("turn-timer", {
      initial: { now: Date.now(), turns: [] },
    });

    let ticker: ReturnType<typeof setInterval> | undefined;

    const running = (sessionID: string) =>
      state.turns.findLast(
        (turn) => turn.sessionID === sessionID && turn.endedAt === undefined,
      );

    const anyRunning = () =>
      state.turns.some((turn) => turn.endedAt === undefined);

    const startTicker = () => {
      if (ticker) return;
      ticker = setInterval(() => {
        update((draft) => {
          draft.now = Date.now();
        });
      }, 1000);
    };

    const stopTicker = () => {
      if (!ticker) return;
      clearInterval(ticker);
      ticker = undefined;
    };

    const stop = context.data.listen(({ details }) => {
      if (details.type === "session.execution.started") {
        const { sessionID } = details.data;
        // A repeated start for a turn we are already timing must not reset it.
        if (running(sessionID)) return;

        const startedAt = Date.now();
        update((draft) => {
          // Only the latest turn per session is displayed, so older ones are noise.
          draft.turns = draft.turns.filter(
            (turn) => turn.sessionID !== sessionID,
          );
          draft.turns.push({
            sessionID,
            startedAt,
            endedAt: undefined,
            outcome: undefined,
          });
          draft.now = startedAt;
        });
        startTicker();
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
      if (!running(sessionID)) return;

      const endedAt = Date.now();
      update((draft) => {
        const current = draft.turns.find(
          (candidate) =>
            candidate.sessionID === sessionID &&
            candidate.endedAt === undefined,
        );
        if (!current) return;
        current.endedAt = endedAt;
        current.outcome = outcome;
        draft.now = endedAt;
      });
      if (!anyRunning()) stopTicker();
    });

    // Memory survives a reload, so a turn that is still running when this plugin
    // is loaded again needs its ticker back without seeing a new start event.
    if (anyRunning()) startTicker();

    context.ui.slot({
      // Appending to the status slot put the timer before the context-usage
      // and hint items, which come and go; because the row is right-aligned,
      // that made the clock jump. Appending to the footer boundary puts it
      // after those claims, so the clock keeps a stable place at the right.
      append: "prompt.footer",
      render: ({ sessionID }) => {
        if (!sessionID) return null;

        const turn = state.turns.findLast(
          (candidate) => candidate.sessionID === sessionID,
        );
        if (!turn) return null;

        const isRunning = turn.endedAt === undefined;
        const elapsed = (turn.endedAt ?? state.now) - turn.startedAt;
        const label = `⏱ ${duration(elapsed)}`;
        const color = isRunning
          ? context.theme.text.base
          : turn.outcome === "failed"
            ? context.theme.text.feedback.error.base
            : turn.outcome === "interrupted"
              ? context.theme.text.feedback.warning.base
              : context.theme.text.faint;

        return (
          <text fg={color} flexShrink={0} wrapMode="none">
            {label}
          </text>
        );
      },
    });

    return () => {
      stop();
      stopTicker();
    };
  },
});
