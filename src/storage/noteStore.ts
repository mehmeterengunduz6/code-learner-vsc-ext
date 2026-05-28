import * as vscode from "vscode";
import { NoteSchema, type Note } from "./schema";
import { findSymbol } from "../anchor/symbolAnchor";
import { blockHash } from "../anchor/hashAnchor";

const NOTES_DIR = ".codelearner/notes";
const NOTES_GLOB = "**/.codelearner/notes/*.json";

interface NoteLocation {
  folder: vscode.WorkspaceFolder;
  fileUri: vscode.Uri;
}

export class NoteStore implements vscode.Disposable {
  private byFile = new Map<string, Note[]>();
  private byId = new Map<string, Note>();
  private locById = new Map<string, NoteLocation>();
  private readonly emitter = new vscode.EventEmitter<void>();
  private readonly watchers: vscode.FileSystemWatcher[] = [];
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChange = this.emitter.event;

  constructor(private readonly output: vscode.OutputChannel) {}

  async initialize(): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      this.watchFolder(folder);
      await this.loadFolder(folder);
    }
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
        for (const added of e.added) {
          this.watchFolder(added);
          await this.loadFolder(added);
        }
        for (const removed of e.removed) {
          this.clearFolder(removed);
        }
        this.emitter.fire();
      }),
    );
  }

  getNotesForFile(fileUri: vscode.Uri): Note[] {
    return this.byFile.get(fileUri.toString()) ?? [];
  }

  getById(id: string): Note | undefined {
    return this.byId.get(id);
  }

  getAllNotes(): Note[] {
    return [...this.byId.values()];
  }

  async recomputeHashes(ids?: string[]): Promise<RecomputeReport> {
    const targets = ids ?? [...this.byId.keys()];
    const report: RecomputeReport = { updated: 0, unchanged: 0, missing: 0, skipped: 0, details: [] };
    const now = new Date().toISOString();

    for (const id of targets) {
      const note = this.byId.get(id);
      const loc = this.locById.get(id);
      if (!note || !loc) {
        report.skipped++;
        continue;
      }
      const docUri = vscode.Uri.joinPath(loc.folder.uri, note.file);
      let doc: vscode.TextDocument;
      try {
        doc = await vscode.workspace.openTextDocument(docUri);
      } catch {
        report.missing++;
        report.details.push(`${note.file} :: ${note.anchors.symbol} — file not found`);
        continue;
      }
      const hit = await findSymbol(doc, note.anchors.symbol);
      if (!hit) {
        const symbols = (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          "vscode.executeDocumentSymbolProvider",
          doc.uri,
        )) ?? [];
        const topNames = symbols.map((s) => s.name).join(", ") || "(none)";
        report.missing++;
        report.details.push(
          `${note.file} :: ${note.anchors.symbol} — symbol not found. Top-level symbols seen: ${topNames}`,
        );
        continue;
      }
      const text = doc.getText(hit.range);
      const newHash = blockHash(text);
      if (newHash === note.anchors.contentHash && note.state === "active") {
        report.unchanged++;
        continue;
      }
      const next: Note = {
        ...note,
        anchors: { ...note.anchors, contentHash: newHash },
        state: "active",
        updatedAt: now,
      };
      const out = new TextEncoder().encode(JSON.stringify(next, null, 2) + "\n");
      await vscode.workspace.fs.writeFile(loc.fileUri, out);
      report.updated++;
      report.details.push(`${note.file} :: ${note.anchors.symbol} — hash refreshed`);
      this.output.appendLine(`[noteStore] recomputed hash for ${id} (${note.anchors.symbol})`);
    }

    return report;
  }

  async markOrphaned(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    for (const id of ids) {
      const loc = this.locById.get(id);
      const note = this.byId.get(id);
      if (!loc || !note || note.state !== "active") continue;
      const next: Note = { ...note, state: "orphaned", updatedAt: now };
      const out = new TextEncoder().encode(JSON.stringify(next, null, 2) + "\n");
      await vscode.workspace.fs.writeFile(loc.fileUri, out);
      this.output.appendLine(`[noteStore] auto-orphaned ${id}`);
    }
  }

  private watchFolder(folder: vscode.WorkspaceFolder): void {
    const pattern = new vscode.RelativePattern(folder, `${NOTES_DIR}/*.json`);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const reload = async () => {
      await this.loadFolder(folder);
      this.emitter.fire();
    };
    watcher.onDidCreate(reload);
    watcher.onDidChange(reload);
    watcher.onDidDelete(reload);
    this.watchers.push(watcher);
  }

  private async loadFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    this.clearFolder(folder);
    const dirUri = vscode.Uri.joinPath(folder.uri, ".codelearner", "notes");

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return;
    }

    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File || !name.endsWith(".json")) continue;
      const noteUri = vscode.Uri.joinPath(dirUri, name);
      let raw: Uint8Array;
      try {
        raw = await vscode.workspace.fs.readFile(noteUri);
      } catch {
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(raw));
      } catch (e) {
        this.output.appendLine(`[noteStore] ${noteUri.fsPath}: invalid JSON — ${(e as Error).message}`);
        continue;
      }
      const result = NoteSchema.safeParse(parsed);
      if (!result.success) {
        this.output.appendLine(`[noteStore] ${noteUri.fsPath}: schema errors —`);
        for (const issue of result.error.issues) {
          this.output.appendLine(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
        continue;
      }
      const note = result.data;
      const absUri = vscode.Uri.joinPath(folder.uri, note.file);
      const key = absUri.toString();
      const list = this.byFile.get(key) ?? [];
      list.push(note);
      this.byFile.set(key, list);
      this.byId.set(note.id, note);
      this.locById.set(note.id, { folder, fileUri: noteUri });
    }
  }

  private clearFolder(folder: vscode.WorkspaceFolder): void {
    const prefix = folder.uri.toString();
    for (const key of [...this.byFile.keys()]) {
      if (key.startsWith(prefix)) this.byFile.delete(key);
    }
    for (const [id, loc] of [...this.locById.entries()]) {
      if (loc.folder.uri.toString() === folder.uri.toString()) {
        this.locById.delete(id);
        this.byId.delete(id);
      }
    }
  }

  dispose(): void {
    this.emitter.dispose();
    for (const w of this.watchers) w.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

export interface RecomputeReport {
  updated: number;
  unchanged: number;
  missing: number;
  skipped: number;
  details: string[];
}

export { NOTES_GLOB, NOTES_DIR };
