<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { basicSetup, EditorView } from "codemirror";
  import { Compartment, EditorState, Prec } from "@codemirror/state";
  import { keymap, placeholder as placeholderExt } from "@codemirror/view";
  import { PostgreSQL, sql, type SQLNamespace } from "@codemirror/lang-sql";
  import { oneDark } from "@codemirror/theme-one-dark";

  let {
    value = $bindable(""),
    onRun = () => {},
    schema = {},
    placeholder = "",
    readOnly = false,
    minHeight = "6rem",
  }: {
    value?: string;
    onRun?: () => void;
    schema?: Record<string, string[]>;
    placeholder?: string;
    readOnly?: boolean;
    minHeight?: string;
  } = $props();

  let el = $state<HTMLDivElement | undefined>();
  let view: EditorView | undefined;
  // Guard so doc changes originating from the editor don't loop back into a
  // transaction via the reactive sync below.
  let updatingFromEditor = false;
  // Latest onRun, so the keymap closure always calls the current callback
  // without re-mounting the editor when the prop changes.
  let onRunRef: () => void = () => {};
  $effect(() => {
    onRunRef = onRun;
  });

  const themeCompartment = new Compartment();

  function isDark(): boolean {
    return (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
    );
  }

  function themeExtension() {
    return isDark() ? oneDark : EditorView.theme({});
  }

  // Mount CodeMirror (client-side: $effect only runs in the browser).
  // Only `el` is a tracked dependency; props are read untracked so changes to
  // them (e.g. `value` on every keystroke) don't tear down and rebuild the view.
  $effect(() => {
    if (!el) return;
    const parent = el;

    const { initialDoc, schemaCfg, placeholderText, isReadOnly, minH } = untrack(
      () => ({
        initialDoc: value,
        schemaCfg: schema as SQLNamespace,
        placeholderText: placeholder,
        isReadOnly: readOnly,
        minH: minHeight,
      }),
    );

    const baseTheme = EditorView.theme({
      "&": { minHeight: minH },
      ".cm-content": { fontFamily: "ui-monospace, monospace" },
      ".cm-scroller": { fontFamily: "ui-monospace, monospace" },
    });

    const extensions = [
      basicSetup,
      sql({
        dialect: PostgreSQL,
        schema: schemaCfg,
        upperCaseKeywords: true,
      }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef();
              return true;
            },
          },
        ]),
      ),
      themeCompartment.of(themeExtension()),
      baseTheme,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        updatingFromEditor = true;
        value = update.state.doc.toString();
        updatingFromEditor = false;
      }),
    ];

    if (placeholderText) {
      extensions.push(placeholderExt(placeholderText));
    }

    if (isReadOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    }

    view = new EditorView({
      state: EditorState.create({ doc: initialDoc, extensions }),
      parent,
    });

    // React to dark-mode toggles (the app flips the `dark` class on <html>).
    const observer = new MutationObserver(() => {
      view?.dispatch({
        effects: themeCompartment.reconfigure(themeExtension()),
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      view?.destroy();
      view = undefined;
    };
  });

  // Push external `value` changes into the editor without re-triggering the
  // update listener (guarded by `updatingFromEditor`).
  $effect(() => {
    const next = value;
    if (!view || updatingFromEditor) return;
    const current = view.state.doc.toString();
    if (next === current) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
    });
  });

  onDestroy(() => {
    view?.destroy();
    view = undefined;
  });
</script>

<div bind:this={el} class="cm-editor-host"></div>
