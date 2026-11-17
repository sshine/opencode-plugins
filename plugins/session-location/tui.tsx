import { Plugin } from "@opencode/plugin/tui";

/**
 * Keep the working directory on the right-hand side of the prompt footer at all
 * times.
 *
 * OpenCode renders the location at the far left only while the session is idle,
 * and replaces it with the spinner and `esc interrupt` while a turn runs. This
 * plugin hides that built-in location text and contributes the path after the
 * status area instead, so the path is always in the right-hand part of the
 * footer, whether or not a turn is active.
 *
 * The built-in location text carries `id="prompt.footer.location"`; hiding it is
 * what keeps the path from appearing on the left. It is a host renderable, so
 * the plugin re-hides it after the host remounts it and restores it on unload.
 * The host text also owns click-to-change-directory; the plugin's copy is
 * display-only.
 */
export default Plugin.define({
  id: "local.session-location",
  setup(context) {
    const fallback = context.location ?? context.data.location.default();
    void context.data.location.vcs.sync(fallback).catch(() => {});

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const hideHost = () => {
      const host = context.renderer.root.findDescendantById(
        "prompt.footer.location",
      );
      if (host) host.visible = false;
    };

    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideHost, 0);
    };

    // The host path is conditional: it mounts when a turn ends and unmounts
    // when one starts. Re-hide it on both transitions and keep a slow sweep as
    // a backstop for host re-renders.
    const stop = context.data.listen(({ details }) => {
      if (
        details.type === "session.viewed" ||
        details.type.startsWith("session.execution.")
      )
        scheduleHide();
    });
    const sweep = setInterval(hideHost, 500);
    hideHost();

    context.ui.slot({
      append: "prompt.footer.status",
      render: ({ sessionID }) => {
        if (!sessionID) return null;

        const location =
          context.data.session.get(sessionID)?.location ?? fallback;
        const directory = context.ui.format.path(location.directory);
        const branch = context.data.location.vcs.info(location)?.branch.current;
        const label = branch ? `${directory}:${branch}` : directory;

        // Our contribution is rendered right after the (now empty) host status
        // box; the host may have just remounted its location beside it.
        queueMicrotask(scheduleHide);

        return (
          <text
            fg={context.theme.text.muted}
            wrapMode="none"
            truncate
            flexShrink={1}
          >
            {label}
          </text>
        );
      },
    });

    return () => {
      stop();
      clearTimeout(hideTimer);
      clearInterval(sweep);
      const host = context.renderer.root.findDescendantById(
        "prompt.footer.location",
      );
      if (host) host.visible = true;
    };
  },
});
