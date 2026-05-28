import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import { NoteStore } from "../storage/noteStore";
import { loadConcept } from "../storage/conceptStore";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

export class SidePanel {
  private static panel: vscode.WebviewPanel | undefined;
  private static currentNoteId: string | undefined;

  static show(store: NoteStore, noteId: string | undefined): void {
    if (!noteId) {
      vscode.window.showInformationMessage("No note specified.");
      return;
    }
    SidePanel.currentNoteId = noteId;

    if (!SidePanel.panel) {
      SidePanel.panel = vscode.window.createWebviewPanel(
        "codeLearner.note",
        "Code Learner",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true },
      );
      SidePanel.panel.onDidDispose(() => {
        SidePanel.panel = undefined;
        SidePanel.currentNoteId = undefined;
      });
      const refresh = () => SidePanel.render(store);
      store.onDidChange(refresh);
      SidePanel.panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === "ready") SidePanel.render(store);
        else if (msg?.type === "openConcept" && typeof msg.slug === "string") {
          const text = await loadConcept(msg.slug);
          const html = text ? md.render(text) : `<p><em>No definition yet for <code>${escapeHtml(msg.slug)}</code>.</em></p>`;
          SidePanel.panel?.webview.postMessage({ type: "concept", slug: msg.slug, html });
        }
      });
    }

    SidePanel.render(store);
    SidePanel.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  static showConcept(slug: string): void {
    if (!SidePanel.panel) {
      vscode.window.showInformationMessage(`Open a note first, then click the \`${slug}\` chip.`);
      return;
    }
    SidePanel.panel.webview.postMessage({ type: "switchTab", tab: "concepts" });
    SidePanel.panel.webview.postMessage({ type: "selectConcept", slug });
    SidePanel.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  private static render(store: NoteStore): void {
    if (!SidePanel.panel || !SidePanel.currentNoteId) return;
    const note = store.getById(SidePanel.currentNoteId);
    if (!note) {
      SidePanel.panel.webview.html = wrap("This note no longer exists.", "Code Learner");
      return;
    }
    const explanation = md.render(note.content.explanation);
    const reasoning = md.render(note.content.reasoning);
    const reviewHtml = renderReview(note.content.reviewQuestions ?? []);
    const conceptsHtml = renderConcepts(note.content.conceptTags ?? []);
    SidePanel.panel.title = `📖 ${note.anchors.symbol}`;
    SidePanel.panel.webview.html = wrap(
      buildBody(note.anchors.symbol, note.file, explanation, reasoning, reviewHtml, conceptsHtml),
      note.anchors.symbol,
    );
  }
}

function renderReview(qs: ReadonlyArray<{ q: string; a: string }>): string {
  if (qs.length === 0) return `<p><em>No review questions yet.</em></p>`;
  return qs
    .map(
      (qa) => `<details class="qa"><summary>${escapeHtml(qa.q)}</summary>${md.render(qa.a)}</details>`,
    )
    .join("");
}

function renderConcepts(tags: ReadonlyArray<string>): string {
  if (tags.length === 0) return `<p><em>No concept tags.</em></p>`;
  const chips = tags
    .map((slug) => `<button class="chip" data-slug="${escapeHtml(slug)}">${escapeHtml(slug)}</button>`)
    .join("");
  return `<div class="chips">${chips}</div><div id="concept-target" class="concept-target"></div>`;
}

function buildBody(
  symbol: string,
  file: string,
  explanationHtml: string,
  reasoningHtml: string,
  reviewHtml: string,
  conceptsHtml: string,
): string {
  return `
<header>
  <h1>${escapeHtml(symbol)}</h1>
  <div class="file">${escapeHtml(file)}</div>
</header>
<nav class="tabs">
  <button class="tab active" data-tab="explanation">Explanation</button>
  <button class="tab" data-tab="reasoning">Reasoning</button>
  <button class="tab" data-tab="review">Review</button>
  <button class="tab" data-tab="concepts">Concepts</button>
</nav>
<section id="tab-explanation" class="panel active">${explanationHtml}</section>
<section id="tab-reasoning" class="panel">${reasoningHtml}</section>
<section id="tab-review" class="panel">${reviewHtml}</section>
<section id="tab-concepts" class="panel">${conceptsHtml}</section>
<script>
  const vscode = acquireVsCodeApi();
  vscode.postMessage({ type: "ready" });
  function activate(tabName) {
    for (const b of document.querySelectorAll(".tab")) b.classList.remove("active");
    for (const p of document.querySelectorAll(".panel")) p.classList.remove("active");
    const btn = document.querySelector('.tab[data-tab="' + tabName + '"]');
    const panel = document.getElementById("tab-" + tabName);
    if (btn) btn.classList.add("active");
    if (panel) panel.classList.add("active");
  }
  for (const btn of document.querySelectorAll(".tab")) {
    btn.addEventListener("click", () => activate(btn.dataset.tab));
  }
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      vscode.postMessage({ type: "openConcept", slug: chip.dataset.slug });
    });
  }
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg?.type === "concept") {
      const target = document.getElementById("concept-target");
      if (target) {
        target.innerHTML = '<div class="concept-head">' + msg.slug + '</div>' + msg.html;
      }
    } else if (msg?.type === "switchTab") {
      activate(msg.tab);
    } else if (msg?.type === "selectConcept") {
      vscode.postMessage({ type: "openConcept", slug: msg.slug });
    }
  });
</script>
`;
}

function wrap(body: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

const CSS = `
:root { color-scheme: light dark; }
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  margin: 0;
  padding: 0;
  line-height: 1.55;
}
header { padding: 18px 22px 6px; border-bottom: 1px solid var(--vscode-panel-border); }
header h1 { margin: 0 0 4px; font-size: 1.15em; font-weight: 600; }
header .file { font-size: 0.85em; opacity: 0.7; font-family: var(--vscode-editor-font-family, monospace); }
.tabs { display: flex; gap: 4px; padding: 8px 22px 0; border-bottom: 1px solid var(--vscode-panel-border); }
.tab {
  background: transparent; border: none; color: var(--vscode-foreground);
  padding: 8px 14px; cursor: pointer; font-size: 0.95em;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab.active { border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
.panel { display: none; padding: 18px 22px; }
.panel.active { display: block; }
.panel p { margin: 0.6em 0; }
.panel code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; font-family: var(--vscode-editor-font-family, monospace); }
.panel pre { background: var(--vscode-textCodeBlock-background); padding: 10px 12px; border-radius: 4px; overflow-x: auto; }
.panel pre code { padding: 0; background: transparent; }
.panel ul, .panel ol { padding-left: 1.4em; }
.panel a { color: var(--vscode-textLink-foreground); }
.qa { margin: 8px 0; padding: 8px 12px; background: var(--vscode-textCodeBlock-background); border-radius: 4px; }
.qa summary { cursor: pointer; font-weight: 500; }
.qa[open] summary { margin-bottom: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.chip {
  background: var(--vscode-textCodeBlock-background); color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border); border-radius: 999px;
  padding: 3px 10px; font-size: 0.85em; cursor: pointer;
  font-family: var(--vscode-editor-font-family, monospace);
}
.chip:hover { border-color: var(--vscode-focusBorder); }
.concept-target { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border); }
.concept-head { font-family: var(--vscode-editor-font-family, monospace); font-weight: 600; margin-bottom: 6px; opacity: 0.8; }
.concept-target:empty { display: none; }
`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
