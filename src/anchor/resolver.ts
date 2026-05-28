import * as vscode from "vscode";
import type { Note } from "../storage/schema";
import { findSymbol } from "./symbolAnchor";
import { blockHash } from "./hashAnchor";

export interface Resolved {
  note: Note;
  range: vscode.Range;
  selectionRange: vscode.Range;
  hashMatches: boolean;
}

export async function resolveNote(doc: vscode.TextDocument, note: Note): Promise<Resolved | undefined> {
  const hit = await findSymbol(doc, note.anchors.symbol);
  if (!hit) return undefined;
  const text = doc.getText(hit.range);
  const hashMatches = blockHash(text) === note.anchors.contentHash;
  return { note, range: hit.range, selectionRange: hit.selectionRange, hashMatches };
}

export async function resolveAll(doc: vscode.TextDocument, notes: Note[]): Promise<Resolved[]> {
  const out: Resolved[] = [];
  for (const note of notes) {
    if (note.state !== "active") continue;
    const r = await resolveNote(doc, note);
    if (r) out.push(r);
  }
  return out;
}
