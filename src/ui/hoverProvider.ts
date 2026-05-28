import * as vscode from "vscode";
import { NoteStore } from "../storage/noteStore";
import { resolveAll } from "../anchor/resolver";

export class CodeLearnerHoverProvider implements vscode.HoverProvider {
  constructor(private readonly store: NoteStore) {}

  async provideHover(doc: vscode.TextDocument, pos: vscode.Position): Promise<vscode.Hover | undefined> {
    const notes = this.store.getNotesForFile(doc.uri);
    if (notes.length === 0) return undefined;

    const resolved = await resolveAll(doc, notes);
    const hit = resolved.find((r) => r.range.contains(pos));
    if (!hit) return undefined;

    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.supportHtml = false;

    md.appendMarkdown(`**📖 ${escapeMd(hit.note.anchors.symbol)}**`);
    if (!hit.hashMatches) {
      md.appendMarkdown(`  \n*(block edited since note was written — content may be stale)*`);
    }
    md.appendMarkdown(`\n\n`);
    md.appendMarkdown(`**Explanation**\n\n${preview(hit.note.content.explanation, 400)}\n\n`);
    md.appendMarkdown(`**Reasoning**\n\n${preview(latestReasoning(hit.note.content.reasoning), 400)}\n\n`);

    const qs = hit.note.content.reviewQuestions ?? [];
    if (qs.length > 0) {
      const rehearseArgs = encodeURIComponent(JSON.stringify([{ noteId: hit.note.id }]));
      md.appendMarkdown(`**Likely review questions** (${qs.length}) — [Rehearse](command:codeLearner.rehearseNote?${rehearseArgs})\n\n`);
      md.appendMarkdown(`> ${escapeMd(qs[0].q)}\n\n`);
    }

    const tags = hit.note.content.conceptTags ?? [];
    if (tags.length > 0) {
      const chips = tags.map((slug) => {
        const args = encodeURIComponent(JSON.stringify([{ slug }]));
        return `[\`${escapeMd(slug)}\`](command:codeLearner.openConcept?${args})`;
      });
      md.appendMarkdown(`**Concepts:** ${chips.join(" ")}\n\n`);
    }

    const openArgs = encodeURIComponent(JSON.stringify([{ noteId: hit.note.id }]));
    md.appendMarkdown(`[Open full note](command:codeLearner.openSidePanel?${openArgs})`);

    return new vscode.Hover(md, hit.range);
  }
}

function latestReasoning(text: string): string {
  const marker = "**Changed in this edit:**";
  const first = text.indexOf(marker);
  if (first === -1) return text;
  const second = text.indexOf(marker, first + marker.length);
  if (second === -1) return text;
  return text.slice(first, second).trimEnd();
}

function preview(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit).trimEnd() + "…";
}

function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}
