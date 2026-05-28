import * as vscode from "vscode";
import { NoteStore } from "../storage/noteStore";
import { resolveAll } from "../anchor/resolver";

export class NoteDecorations implements vscode.Disposable {
  private readonly active: vscode.TextEditorDecorationType;
  private readonly stale: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private debounce: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext, private readonly store: NoteStore) {
    const iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "note.svg");

    this.active = vscode.window.createTextEditorDecorationType({
      gutterIconPath: iconPath,
      gutterIconSize: "75%",
      overviewRulerColor: "#9cdcfe",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      backgroundColor: "#9cdcfe26",
      borderRadius: "2px",
      isWholeLine: false,
    });

    this.stale = vscode.window.createTextEditorDecorationType({
      gutterIconPath: iconPath,
      gutterIconSize: "75%",
      overviewRulerColor: "#d19a66",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      backgroundColor: "#d19a6655",
      borderRadius: "2px",
      isWholeLine: false,
    });

    this.disposables.push(
      this.active,
      this.stale,
      vscode.window.onDidChangeActiveTextEditor((e) => e && this.refresh(e)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === e.document) this.schedule(editor);
      }),
      store.onDidChange(() => {
        for (const editor of vscode.window.visibleTextEditors) this.refresh(editor);
      }),
    );

    for (const editor of vscode.window.visibleTextEditors) this.refresh(editor);
  }

  private schedule(editor: vscode.TextEditor): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.refresh(editor), 250);
  }

  private async refresh(editor: vscode.TextEditor): Promise<void> {
    const notes = this.store.getNotesForFile(editor.document.uri);
    if (notes.length === 0) {
      editor.setDecorations(this.active, []);
      editor.setDecorations(this.stale, []);
      return;
    }
    const resolved = await resolveAll(editor.document, notes);
    const activeRanges: vscode.DecorationOptions[] = [];
    const orphanIds: string[] = [];
    for (const r of resolved) {
      if (r.hashMatches) {
        activeRanges.push({ range: r.range });
      } else {
        orphanIds.push(r.note.id);
      }
    }
    editor.setDecorations(this.active, activeRanges);
    editor.setDecorations(this.stale, []);
    if (orphanIds.length > 0) void this.store.markOrphaned(orphanIds);
  }

  dispose(): void {
    if (this.debounce) clearTimeout(this.debounce);
    for (const d of this.disposables) d.dispose();
  }
}
