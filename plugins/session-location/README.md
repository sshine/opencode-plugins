# Session location

Keeps the working directory on the right-hand side of the prompt footer at all
times.

OpenCode puts the location at the far left, but only while the session is idle;
while a turn runs it replaces that space with the spinner and `esc interrupt`.
This plugin hides the built-in left location text and contributes the path
after the status area instead, so:

- the path is in the right-hand part of the footer whether a turn is running or
  not;
- the spinner and `esc interrupt` keep the left side to themselves;
- there is never a second path on the left.

The label is the session's location, abbreviated with `~` by OpenCode's path
formatter, with the current git branch appended when VCS information is
available. On a narrow terminal it truncates before it pushes the footer apart.

## Trade-off

The built-in location text carries `id="prompt.footer.location"`, which is what
lets the plugin hide it. That text also owns the click-to-change-directory
action; the plugin's copy is display-only. The host may remount the text when a
turn starts or ends, so the plugin re-hides it after those transitions (with a
slow sweep as a backstop) and restores it when the plugin unloads.
