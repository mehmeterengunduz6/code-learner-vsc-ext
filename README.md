# Know Your Code

> Notion-style notes on AI-generated code — written by your coding agent, read by you.

Know Your Code is a VS Code / Cursor extension for people who **write code with AI and then have to defend it in PR review**. As your coding agent edits a file, it leaves a per-block note explaining *what* the code does, *why* it was written that way, and the *questions a reviewer is likely to ask*. You read those notes inline — on hover, in a side panel, or in a guided "rehearse" flow — so you walk into review actually understanding the code in your own PR.

The notes are authored by the agent, not by you. You just read them.

---

## Why

AI writes a lot of our code now. The gap that opens up isn't *getting* the code — it's being able to **explain and defend** it: in code review, in an interview, to a teammate, to your future self. Know Your Code closes that gap by capturing the reasoning at the moment the code is written, anchored to the exact block it describes, and surfacing it when you need it.

## Features

- **Inline hover notes** — hover any annotated block to see its explanation (first), the reasoning behind it, a teaser of review questions, and concept-tag chips.
- **Side panel** — a tabbed webview: **Explanation / Reasoning / Review / Concepts**, with click-through concept lookups.
- **Rehearse mode** — a guided walkthrough of the review questions for recently-changed blocks. Practice defending your PR before you open it.
- **Concept library** — reusable plain-markdown definitions (e.g. `controlled-input`, `use-state`) that notes can tag and link to.
- **Self-healing anchors** — notes locate their block by symbol lookup + a content hash. When code drifts, the note auto-flips to `orphaned` and a subtle gutter highlight tells you which annotations went stale.
- **Agent rule pack** — one command writes the contract (`CLAUDE.md` / `.cursorrules` / Copilot rules) that teaches your coding agent how to author and update notes.

## How it works

```
You + AI agent edit code
        │
        ▼
Agent writes a note per block  ──►  .codelearner/notes/<uuid>.json
        │                            .codelearner/concepts/<slug>.md
        ▼
Extension renders it inline  ──►  hover · side panel · rehearse
```

- Notes live in your workspace at **`.codelearner/notes/<uuid>.json`** (one file per note).
- Concept definitions live at **`.codelearner/concepts/<slug>.md`** as plain markdown.
- Each note carries an `explanation`, `reasoning`, up to 5 `reviewQuestions`, `conceptTags`, and anchoring metadata (`symbol` + `contentHash` + fuzzy context).
- `.codelearner/` is added to `.gitignore` by the rule pack — notes are local learning aids, not committed artifacts.

## Getting started

1. **Install / run the extension.**
   ```bash
   npm install
   npm run build      # bundles to dist/extension.js
   ```
   Press **F5** in VS Code to launch the Extension Development Host. Rebuild + reload (Cmd+R) after changes.

2. **Install the rule pack** into the workspace you want annotated:
   - Command Palette → **Know Your Code: Install Rule Pack**
   - This generates the agent instructions (`CLAUDE.md` / `.cursorrules` / Copilot rules) and gitignores `.codelearner/`.

3. **Code with your agent.** As it edits, it writes notes following the rule pack.

4. **Read the notes:**
   - **Hover** an annotated block.
   - **Know Your Code: Open Note** for the full side panel.
   - **Know Your Code: Rehearse Changes** to drill the review questions.

## Commands

| Command | What it does |
| --- | --- |
| `Know Your Code: Install Rule Pack` | Write the agent contract + gitignore `.codelearner/` |
| `Know Your Code: Open Note` | Open the tabbed side panel for the note at the cursor |
| `Know Your Code: Rehearse Changes` | Walk through review questions for recently-updated notes |
| `Know Your Code: Recompute Note Hashes` | Re-anchor notes after intentional edits |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codeLearner.codeLensEnabled` | `false` | Show a CodeLens above annotated blocks |

## Project layout

```
src/
  extension.ts            activation; registers hover, decorations, panels, commands
  storage/
    schema.ts             zod NoteSchema (the note contract)
    noteStore.ts          loads/watches .codelearner/notes/*.json
    conceptStore.ts       loads concept markdown
  anchor/
    resolver.ts           locate a note's block in the live document
    symbolAnchor.ts       symbol-based lookup
    hashAnchor.ts         SHA-256 of normalized block text
  ui/
    decorations.ts        gutter highlight for active notes; auto-orphans on drift
    hoverProvider.ts      inline hover card
    sidePanel.ts          Explanation / Reasoning / Review / Concepts webview
    rehearsePanel.ts      guided review-question walkthrough
  rulePack/
    body.ts               the agent instructions
    install.ts            writes them into a target workspace
```

## Build / develop

```bash
npm run build       # bundle with esbuild → dist/extension.js
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit
npm run package     # vsce package → .vsix
```

## Status

Early / experimental (`v0.0.1`). Built for VS Code `^1.90` and works in Cursor.

## License

TODO — add a license before wider sharing (MIT recommended for an open repo).
