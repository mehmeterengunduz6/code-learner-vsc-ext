import * as vscode from "vscode";
import { RULE_PACK_TARGETS, renderRulePack, type RulePackFlavor, type RulePackTarget } from "./body";

const GITIGNORE_LINE = ".codelearner/";
const BLOCK_BEGIN = "<!-- BEGIN Know Your Code rule pack -->";
const BLOCK_END = "<!-- END Know Your Code rule pack -->";

/** The rule pack wrapped in markers so it can be detected and updated in place. */
function rulePackBlock(target: RulePackTarget): string {
  return `${BLOCK_BEGIN}\n${renderRulePack(target)}\n${BLOCK_END}\n`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace an already-installed block in place, else null if none present. */
function replaceExistingBlock(existing: string, block: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(BLOCK_BEGIN)}[\\s\\S]*?${escapeRegExp(BLOCK_END)}\\n?`);
  if (!pattern.test(existing)) return null;
  return existing.replace(pattern, block);
}

/** Append the block to the end of existing content, separated by a blank line. */
function appendBlock(existing: string, block: string): string {
  return `${existing.replace(/\s*$/, "")}\n\n${block}`;
}

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
      title: "Know Your Code — Install Rule Pack",
      placeHolder: "Pick the agents you use in this workspace",
    },
  );
  if (!picks || picks.length === 0) return;

  const written: string[] = [];
  const skipped: string[] = [];

  for (const pick of picks) {
    const target = RULE_PACK_TARGETS[pick.flavor as RulePackFlavor];
    const uri = vscode.Uri.joinPath(folder.uri, target.relativePath);
    const block = rulePackBlock(target);
    let contents = block;

    if (await fileExists(uri)) {
      const existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));

      // Already installed: update the marked section in place, no prompt.
      const updated = replaceExistingBlock(existing, block);
      if (updated !== null) {
        if (updated === existing) {
          skipped.push(`${target.relativePath} (already up to date)`);
          continue;
        }
        contents = updated;
      } else {
        // Existing file with no rule pack yet: append or overwrite.
        const choice = await vscode.window.showWarningMessage(
          `${target.relativePath} already exists. Append the Know Your Code rule pack, or overwrite the file?`,
          { modal: true },
          "Append",
          "Overwrite",
          "Skip",
        );
        if (choice === "Append") {
          contents = appendBlock(existing, block);
        } else if (choice === "Overwrite") {
          contents = block;
        } else {
          skipped.push(target.relativePath);
          continue;
        }
      }
    }

    const parentDir = vscode.Uri.joinPath(uri, "..");
    try {
      await vscode.workspace.fs.createDirectory(parentDir);
    } catch {
      // ignore — parent may already exist
    }
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(contents));
    written.push(target.relativePath);
    output.appendLine(`[rulePack] wrote ${uri.fsPath}`);
  }

  await ensureGitignoreEntry(folder, output);

  if (written.length > 0) {
    vscode.window.showInformationMessage(
      `Know Your Code rule pack installed: ${written.join(", ")}` +
        (skipped.length ? ` (skipped ${skipped.join(", ")})` : ""),
    );
  } else if (skipped.length > 0) {
    vscode.window.showInformationMessage(`Know Your Code rule pack: skipped ${skipped.join(", ")}`);
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
