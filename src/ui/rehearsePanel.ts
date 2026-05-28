import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import { NoteStore } from "../storage/noteStore";
import type { Note } from "../storage/schema";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
const CONFIDENT_KEY = "codeLearner.confidentNoteIds";
const REHEARSE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Card {
  noteId: string;
  symbol: string;
  file: string;
  q: string;
  a: string;
}

export class RehearsePanel {
  private static panel: vscode.WebviewPanel | undefined;

  static showChanges(context: vscode.ExtensionContext, store: NoteStore): void {
    const notes = recentlyChanged(store, REHEARSE_WINDOW_MS);
    if (notes.length === 0) {
      vscode.window.showInformationMessage("No recently-updated notes to rehearse. (Looking at notes updated in the last 24h.)");
      return;
    }
    RehearsePanel.open(context, store, buildCards(notes), buildSummary(notes));
  }

  static showNote(context: vscode.ExtensionContext, store: NoteStore, noteId: string): void {
    const note = store.getById(noteId);
    if (!note) {
      vscode.window.showWarningMessage("Note not found.");
      return;
    }
    RehearsePanel.open(context, store, buildCards([note]), buildSummary([note]));
  }

  private static open(context: vscode.ExtensionContext, store: NoteStore, cards: Card[], summary: string): void {
    if (cards.length === 0) {
      vscode.window.showInformationMessage("These notes don't have review questions yet.");
      return;
    }

    if (!RehearsePanel.panel) {
      RehearsePanel.panel = vscode.window.createWebviewPanel(
        "codeLearner.rehearse",
        "Code Learner — Rehearse",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        { enableScripts: true, retainContextWhenHidden: true },
      );
      RehearsePanel.panel.onDidDispose(() => {
        RehearsePanel.panel = undefined;
      });
    }

    const confident = new Set<string>(context.workspaceState.get<string[]>(CONFIDENT_KEY, []));
    RehearsePanel.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "markConfident" && typeof msg.noteId === "string") {
        confident.add(msg.noteId);
        await context.workspaceState.update(CONFIDENT_KEY, [...confident]);
      } else if (msg?.type === "unmarkConfident" && typeof msg.noteId === "string") {
        confident.delete(msg.noteId);
        await context.workspaceState.update(CONFIDENT_KEY, [...confident]);
      } else if (msg?.type === "copySummary") {
        await vscode.env.clipboard.writeText(summary);
        vscode.window.showInformationMessage("PR summary copied to clipboard.");
      }
    });

    RehearsePanel.panel.title = `Rehearse — ${cards.length} question${cards.length === 1 ? "" : "s"}`;
    RehearsePanel.panel.webview.html = render(cards, [...confident]);
    RehearsePanel.panel.reveal(vscode.ViewColumn.Beside, false);
  }
}

function recentlyChanged(store: NoteStore, withinMs: number): Note[] {
  const cutoff = Date.now() - withinMs;
  return store.getAllNotes().filter((n) => n.state === "active" && Date.parse(n.updatedAt) >= cutoff);
}

function buildCards(notes: Note[]): Card[] {
  const cards: Card[] = [];
  for (const note of notes) {
    for (const qa of note.content.reviewQuestions ?? []) {
      cards.push({
        noteId: note.id,
        symbol: note.anchors.symbol,
        file: note.file,
        q: qa.q,
        a: qa.a,
      });
    }
  }
  return cards;
}

function buildSummary(notes: Note[]): string {
  const lines = ["## Changes in this PR", ""];
  for (const n of notes) {
    const firstLine = n.content.explanation.split(/\r?\n/)[0].trim();
    lines.push(`- **${n.anchors.symbol}** (\`${n.file}\`) — ${firstLine}`);
  }
  return lines.join("\n") + "\n";
}

function render(cards: Card[], confidentIds: string[]): string {
  const confidentSet = JSON.stringify(confidentIds);
  const cardsJson = JSON.stringify(
    cards.map((c) => ({
      ...c,
      aHtml: md.render(c.a),
    })),
  );
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${CSS}</style></head><body>
<header>
  <h1>Rehearse review questions</h1>
  <div class="progress"><span id="idx">1</span> / ${cards.length}</div>
</header>
<main>
  <div class="card-meta">
    <span id="symbol"></span>
    <span class="file" id="file"></span>
  </div>
  <div class="question" id="question"></div>
  <button id="reveal" class="reveal">Show answer</button>
  <div class="answer" id="answer" hidden></div>
  <div class="confidence">
    <label><input type="checkbox" id="confident"> I can answer this confidently</label>
  </div>
</main>
<footer>
  <button id="prev">← Previous</button>
  <button id="next">Next →</button>
  <button id="copy" class="ghost">Copy PR summary</button>
</footer>
<div id="done" class="done" hidden>
  <h2>Done.</h2>
  <p>You rehearsed <strong>${cards.length}</strong> question${cards.length === 1 ? "" : "s"}.</p>
  <button id="copy2">Copy PR summary</button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const cards = ${cardsJson};
  const confident = new Set(${confidentSet});
  let i = 0;

  function show() {
    if (i >= cards.length) {
      document.querySelector("main").hidden = true;
      document.querySelector("footer").hidden = true;
      document.getElementById("done").hidden = false;
      return;
    }
    const c = cards[i];
    document.getElementById("idx").textContent = i + 1;
    document.getElementById("symbol").textContent = c.symbol;
    document.getElementById("file").textContent = c.file;
    document.getElementById("question").textContent = c.q;
    document.getElementById("answer").innerHTML = c.aHtml;
    document.getElementById("answer").hidden = true;
    document.getElementById("reveal").hidden = false;
    document.getElementById("confident").checked = confident.has(c.noteId);
  }

  document.getElementById("reveal").addEventListener("click", () => {
    document.getElementById("answer").hidden = false;
    document.getElementById("reveal").hidden = true;
  });
  document.getElementById("next").addEventListener("click", () => { i = Math.min(cards.length, i + 1); show(); });
  document.getElementById("prev").addEventListener("click", () => { i = Math.max(0, i - 1); show(); });
  document.getElementById("confident").addEventListener("change", (e) => {
    const c = cards[i];
    if (e.target.checked) {
      confident.add(c.noteId);
      vscode.postMessage({ type: "markConfident", noteId: c.noteId });
    } else {
      confident.delete(c.noteId);
      vscode.postMessage({ type: "unmarkConfident", noteId: c.noteId });
    }
  });
  document.getElementById("copy").addEventListener("click", () => vscode.postMessage({ type: "copySummary" }));
  document.getElementById("copy2").addEventListener("click", () => vscode.postMessage({ type: "copySummary" }));

  show();
</script>
</body></html>`;
}

const CSS = `
:root { color-scheme: light dark; }
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; line-height: 1.55; }
header { padding: 18px 22px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; justify-content: space-between; align-items: center; }
header h1 { margin: 0; font-size: 1.05em; font-weight: 600; }
.progress { opacity: 0.6; font-size: 0.9em; }
main { padding: 22px; }
.card-meta { font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; opacity: 0.75; margin-bottom: 18px; display: flex; gap: 14px; }
.card-meta .file { opacity: 0.6; }
.question { font-size: 1.15em; font-weight: 500; margin: 0 0 18px; }
.reveal {
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.95em;
}
.reveal:hover { background: var(--vscode-button-hoverBackground); }
.answer { margin-top: 16px; padding: 14px 18px; background: var(--vscode-textCodeBlock-background); border-radius: 4px; }
.answer p { margin: 0.4em 0; }
.confidence { margin-top: 20px; font-size: 0.9em; opacity: 0.85; }
footer { padding: 14px 22px; border-top: 1px solid var(--vscode-panel-border); display: flex; gap: 8px; align-items: center; }
footer button {
  background: var(--vscode-button-secondaryBackground, transparent);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  border: 1px solid var(--vscode-panel-border); padding: 6px 14px; border-radius: 4px; cursor: pointer;
}
footer button.ghost { margin-left: auto; opacity: 0.85; }
footer button:hover { border-color: var(--vscode-focusBorder); }
.done { padding: 40px 22px; text-align: center; }
.done h2 { margin-top: 0; }
.done button { margin-top: 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
`;
