import * as vscode from "vscode";
import { RULE_PACK_TARGETS, renderRulePack, type RulePackFlavor } from "./body";

const GITIGNORE_LINE = ".codelearner/";

export async function installRulePack(output: vscode.OutputChannel): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) return;

  const picks = await vscode.window.showQuickPick(
    Object.values(RULE_PACK_TARGETS).map((t) => ({
      label: t.label,
      flavor: t.flavor,
      picked: t.flavor === "claude",
    })),
    {
      canPickMany: true,
      title: "Code Learner — Install Rule Pack",
      placeHolder: "Pick the agents you use in this workspace",
    },
  );
  if (!picks || picks.length === 0) return;

  const written: string[] = [];
  const skipped: string[] = [];

  for (const pick of picks) {
    const target = RULE_PACK_TARGETS[pick.flavor as RulePackFlavor];
    const uri = vscode.Uri.joinPath(folder.uri, target.relativePath);

    if (await fileExists(uri)) {
      const overwrite = await vscode.window.showWarningMessage(
        `${target.relativePath} already exists. Overwrite?`,
        { modal: true },
        "Overwrite",
        "Skip",
      );
      if (overwrite !== "Overwrite") {
        skipped.push(target.relativePath);
        continue;
      }
    }

    const parentDir = vscode.Uri.joinPath(uri, "..");
    try {
      await vscode.workspace.fs.createDirectory(parentDir);
    } catch {
      // ignore — parent may already exist
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(renderRulePack(target)));
    written.push(target.relativePath);
    output.appendLine(`[rulePack] wrote ${uri.fsPath}`);
  }

  await ensureGitignoreEntry(folder, output);

  if (written.length > 0) {
    vscode.window.showInformationMessage(
      `Code Learner rule pack installed: ${written.join(", ")}` +
        (skipped.length ? ` (skipped ${skipped.join(", ")})` : ""),
    );
  }
}

async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    vscode.window.showErrorMessage("Open a workspace folder first.");
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: "Where should the rule pack be installed?" });
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function ensureGitignoreEntry(folder: vscode.WorkspaceFolder, output: vscode.OutputChannel): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, ".gitignore");
  let existing = "";
  try {
    existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    // create new
  }
  const lines = existing.split(/\r?\n/);
  if (lines.some((l) => l.trim() === GITIGNORE_LINE)) return;
  const next = (existing && !existing.endsWith("\n") ? existing + "\n" : existing) + `${GITIGNORE_LINE}\n`;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
  output.appendLine(`[rulePack] added ${GITIGNORE_LINE} to .gitignore`);
}
