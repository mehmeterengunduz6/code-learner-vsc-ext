import * as vscode from "vscode";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function loadConcept(slug: string): Promise<string | undefined> {
  if (!SLUG_RE.test(slug)) return undefined;
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const uri = vscode.Uri.joinPath(folder.uri, ".codelearner", "concepts", `${slug}.md`);
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(raw);
    } catch {
      continue;
    }
  }
  return undefined;
}
