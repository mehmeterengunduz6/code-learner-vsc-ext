import * as vscode from "vscode";
import { NoteStore } from "./storage/noteStore";
import { installRulePack } from "./rulePack/install";
import { CodeLearnerHoverProvider } from "./ui/hoverProvider";
import { SidePanel } from "./ui/sidePanel";
import { NoteDecorations } from "./ui/decorations";
import { RehearsePanel } from "./ui/rehearsePanel";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Know Your Code");
  context.subscriptions.push(output);
  output.appendLine("Know Your Code activated.");

  const noteStore = new NoteStore(output);
  context.subscriptions.push(noteStore);
  await noteStore.initialize();

  const decorations = new NoteDecorations(context, noteStore);
  context.subscriptions.push(decorations);

  context.subscriptions.push(
    noteStore.onDidChange(() => {
      output.appendLine("[noteStore] notes reloaded.");
    }),
    vscode.languages.registerHoverProvider({ scheme: "file" }, new CodeLearnerHoverProvider(noteStore)),
    vscode.commands.registerCommand("codeLearner.installRulePack", () => installRulePack(output)),
    vscode.commands.registerCommand("codeLearner.openSidePanel", (args?: { noteId?: string }) => {
      SidePanel.show(noteStore, args?.noteId);
    }),
    vscode.commands.registerCommand("codeLearner.openConcept", (args?: { slug?: string }) => {
      if (args?.slug) SidePanel.showConcept(args.slug);
    }),
    vscode.commands.registerCommand("codeLearner.rehearseChanges", () => {
      RehearsePanel.showChanges(context, noteStore);
    }),
    vscode.commands.registerCommand("codeLearner.rehearseNote", (args?: { noteId?: string }) => {
      if (args?.noteId) RehearsePanel.showNote(context, noteStore, args.noteId);
    }),
    vscode.commands.registerCommand("codeLearner.recomputeHashes", async () => {
      const report = await noteStore.recomputeHashes();
      const msg = `Know Your Code: ${report.updated} updated, ${report.unchanged} unchanged, ${report.missing} missing, ${report.skipped} skipped.`;
      output.appendLine(`[recompute] ${msg}`);
      for (const line of report.details) output.appendLine(`  ${line}`);
      vscode.window.showInformationMessage(msg);
    }),
  );
}

export function deactivate(): void {}
