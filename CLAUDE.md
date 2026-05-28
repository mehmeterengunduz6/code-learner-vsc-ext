# Code Learner — VS Code Extension

## What this is
A VS Code extension that renders per-code-block notes (explanation + reasoning + review prep) authored by a coding agent. Aimed at learners who use AI to write code and must defend that code in PR reviews. Notes live in the workspace at `.codelearner/notes/<uuid>.json` (one file per note); concept definitions live at `.codelearner/concepts/<slug>.md`.

## How it's wired
- `src/extension.ts` — activation; registers hover provider, decorations, side panel command, rehearse command, openConcept command.
- `src/storage/schema.ts` — zod `NoteSchema`. Each note has `id`, `file`, `anchors {symbol, contentHash, fuzzyContext}`, `content {explanation, reasoning, reviewQuestions[], conceptTags[]}`, timestamps, `agent`, `state` ("active" | "orphaned").
- `src/storage/noteStore.ts` — loads `.codelearner/notes/*.json`, watches for changes, emits `onDidChange`. `markOrphaned(ids)` auto-flips state when block hash drifts.
- `src/anchor/{resolver,symbolAnchor,hashAnchor}.ts` — locate a note's block in the live document (symbol lookup → SHA-256 of trimmed/LF-normalized block text).
- `src/ui/decorations.ts` — light-blue gutter highlight for active notes; auto-orphans on hash mismatch.
- `src/ui/hoverProvider.ts` — hover shows Explanation (first), Reasoning, review-Qs teaser, concept-tag chips.
- `src/ui/sidePanel.ts` — webview with tabs Explanation / Reasoning / Review / Concepts. Two-way messaging for concept lookup.
- `src/ui/rehearsePanel.ts` — dedicated two-way webview that walks the user through review questions for recently-updated notes.
- `src/rulePack/{body,install}.ts` — generates `CLAUDE.md` / `.cursorrules` / Copilot rules into a target workspace and adds `.codelearner/` to `.gitignore`. The rule pack is the contract that tells the coding agent how to write/update notes.

## Conventions
- Notes are agent-written; the user reads via hover and rehearse. The agent must not narrate note work in chat.
- `explanation` ≤ 400 chars, `reasoning` ≤ 300 chars, with `**Changed in this edit:** …` line on top when updating.
- Storage is per-file JSON; never reintroduce the legacy `notes.json` array.
- Concept definition files are plain markdown — the extension renders them, the agent (or user) writes them.

## Build / run
- `npm run build` — bundle with esbuild into `dist/extension.js`.
- `npm run watch` — rebuild on change.
- `npm run typecheck` — `tsc --noEmit`.
- F5 in VS Code launches the Extension Development Host; reload with Cmd+R after a build.
