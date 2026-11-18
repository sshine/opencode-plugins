import { Plugin } from "@opencode/plugin/tui";
import {
  TextareaRenderable,
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
  decodePasteBytes,
  type EditBufferRenderable,
} from "@opentui/core";

/**
 * Cut and paste for the prompt and every other textarea.
 *
 * ctrl+u  cut from the cursor to the start of the line (or cut the selection)
 * ctrl+k  cut from the cursor to the end of the line (or cut the selection)
 * ctrl+y  paste the last cut text
 *
 * Cut text is also written to the system clipboard and to the terminal via
 * OSC 52. Paste prefers the in-process cut buffer so it still works instantly
 * when the system clipboard is unavailable (for example over SSH).
 */
export default Plugin.define({
  id: "local.cut-paste",
  setup(context) {
    const clipboard = createClipboard({
      host: createHostClipboard(),
      terminal: createRendererClipboardAdapter(context.renderer),
    });

    let cut = "";

    const focused = (): EditBufferRenderable | undefined => {
      const editor = context.renderer.currentFocusedEditor;
      return editor instanceof TextareaRenderable ? editor : undefined;
    };

    const rememberCut = (text: string) => {
      if (!text) return;
      cut = text;
      void clipboard
        .writeText(text.replaceAll("\0", ""), {
          destination: "all-available",
          selection: "clipboard",
        })
        .catch(() => {
          // The in-process cut buffer still works if no clipboard is available.
        });
    };

    const cutToLineStart = (editor: EditBufferRenderable) => {
      if (editor.getSelection()) {
        rememberCut(editor.getSelectedText());
        editor.deleteChar();
        return;
      }

      const cursor = editor.editorView.getCursor();
      rememberCut(
        cursor.col > 0
          ? editor.getTextRangeByCoords(cursor.row, 0, cursor.row, cursor.col)
          : cursor.row > 0
            ? "\n"
            : "",
      );
      editor.deleteToLineStart();
    };

    const cutToLineEnd = (editor: EditBufferRenderable) => {
      if (editor.getSelection()) {
        rememberCut(editor.getSelectedText());
        editor.deleteChar();
        return;
      }

      const cursor = editor.editorView.getCursor();
      const eol = editor.editBuffer.getEOL();
      rememberCut(
        eol.row === cursor.row && eol.col > cursor.col
          ? editor.getTextRangeByCoords(
              cursor.row,
              cursor.col,
              eol.row,
              eol.col,
            )
          : "",
      );
      editor.deleteToLineEnd();
    };

    const paste = async (editor: EditBufferRenderable) => {
      let text = cut;

      if (!text) {
        const result = await clipboard.read({
          preferredTypes: ["text/plain"],
          selection: "clipboard",
        });
        if (
          result.status === "read" &&
          result.representation.mimeType === "text/plain"
        ) {
          text = decodePasteBytes(result.representation.bytes);
        }
      }

      if (!text) return;
      editor.insertText(text);
    };

    // Deliberately not scoped with `target: () => context.renderer.currentFocusedEditor`:
    // on OpenCode 2.3.0 that layer never dispatches. The `enabled` guard on each
    // command already keeps them inert while no textarea is focused.
    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "local.cut-paste.cut-to-line-start",
          title: "Cut to start of line",
          bind: "ctrl+u",
          enabled: () => focused() !== undefined,
          run: (_input, event) => {
            const editor = focused();
            if (!editor) return false;
            event?.preventDefault();
            event?.stopPropagation();
            cutToLineStart(editor);
          },
        },
        {
          id: "local.cut-paste.cut-to-line-end",
          title: "Cut to end of line",
          bind: "ctrl+k",
          enabled: () => focused() !== undefined,
          run: (_input, event) => {
            const editor = focused();
            if (!editor) return false;
            event?.preventDefault();
            event?.stopPropagation();
            cutToLineEnd(editor);
          },
        },
        {
          id: "local.cut-paste.paste",
          title: "Paste",
          bind: "ctrl+y",
          enabled: () => focused() !== undefined,
          run: async (_input, event) => {
            const editor = focused();
            if (!editor) return;
            event?.preventDefault();
            event?.stopPropagation();
            await paste(editor);
          },
        },
      ],
    }));

    return () => {
      void clipboard.dispose();
    };
  },
});
