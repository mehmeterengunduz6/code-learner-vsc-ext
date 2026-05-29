# Know Your Code

> Notes on AI-generated code — written by your coding agent, read by you.

A VS Code / Cursor extension for people who write code with AI and then have to defend it in review. As your agent edits a file, it leaves a per-block note covering *what* the code does, *why* it's written that way, and the *questions a reviewer might ask*. You read them inline — on hover, in a side panel, or in a guided rehearse flow.

The agent writes the notes. You just read them.

## Why

AI writes a lot of our code now. The hard part isn't getting the code — it's being able to explain and defend it, in review or an interview or to your future self. Know Your Code captures the reasoning when the code is written and surfaces it when you need it.

## Features

- **Hover notes** — explanation, reasoning, a review-question teaser, and concept tags on any annotated block.
- **Side panel** — a tabbed view: Explanation / Reasoning / Review / Concepts, with click-through concept lookups.
- **Rehearse mode** — a guided walkthrough of review questions for recently-changed blocks.
- **Concept library** — reusable markdown definitions that notes can tag and link to.
- **Self-healing anchors** — notes find their block by symbol lookup and detect drift by comparing live code against a verbatim snapshot. On drift, a note auto-flips to `orphaned` with a subtle gutter highlight. The agent copies the block text rather than hashing it, so notes can't break from a bad hash.
- **Agent rule pack** — one command writes the contract that teaches your agent to author notes. It's token-light: a tiny always-loaded rule plus a full spec the agent reads only when it writes a note.

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

- Notes live at `.codelearner/notes/<uuid>.json` (one file per note); concepts at `.codelearner/concepts/<slug>.md`.
- The agent's authoring spec lives at `.codelearner/AGENT.md`, kept out of every-message context.
- Each note carries an `explanation`, `reasoning`, `reviewQuestions`, `conceptTags`, and anchoring metadata (a `symbol` plus a verbatim block snapshot). The extension derives the drift hash from the snapshot on load.
- The rule pack adds `.codelearner/` to `.gitignore` — notes are local aids, not committed.

## Getting started

1. **Build and run:**
   ```bash
   npm install
   npm run build
   ```
   Press **F5** to launch the Extension Development Host. Rebuild + reload (Cmd+R) after changes.

2. **Install the rule pack** into the workspace you want annotated: Command Palette → **Know Your Code: Install Rule Pack**.

3. **Code with your agent.** It writes notes as it edits.

4. **Read the notes** — hover a block, open the side panel, or rehearse the review questions.

## Commands

| Command | What it does |
| --- | --- |
| `Install Rule Pack` | Write the agent contract + gitignore `.codelearner/` |
| `Open Note` | Open the side panel for the note at the cursor |
| `Rehearse Changes` | Walk through review questions for recently-updated notes |
| `Recompute Note Hashes` | Re-anchor notes after intentional edits |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codeLearner.codeLensEnabled` | `false` | Show a CodeLens above annotated blocks |

## Project layout

```
src/
  extension.ts            activation; registers hover, decorations, panels, commands
  storage/                zod NoteSchema, note + concept stores
  anchor/                 locate a note's block; detect drift via block hash
  ui/                     hover card, gutter decorations, side panel, rehearse panel
  rulePack/               the always-loaded rule + on-demand AGENT.md spec
```

## Develop

```bash
npm run build       # bundle → dist/extension.js
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit
npm run package     # vsce package → .vsix
```

## Status

Early / experimental (`v0.0.1`). Built for VS Code `^1.90`; works in Cursor.

## License

[MIT](./LICENSE) © 2026 knowyourcode
