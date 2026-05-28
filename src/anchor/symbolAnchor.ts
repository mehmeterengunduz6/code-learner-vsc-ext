import * as vscode from "vscode";

export interface SymbolHit {
  range: vscode.Range;
  selectionRange: vscode.Range;
}

export async function findSymbol(
  doc: vscode.TextDocument,
  symbolPath: string,
): Promise<SymbolHit | undefined> {
  const parts = symbolPath.split(".");
  for (const delay of [0, 250, 750, 1500]) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const symbols = (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    )) ?? [];
    if (symbols.length === 0) continue;
    const hit = walk(symbols, parts);
    if (hit) return hit;
    return undefined;
  }
  return undefined;
}

function walk(symbols: vscode.DocumentSymbol[], parts: string[]): SymbolHit | undefined {
  if (parts.length === 0) return undefined;
  const [head, ...rest] = parts;
  for (const sym of symbols) {
    if (sym.name === head) {
      if (rest.length === 0) return { range: sym.range, selectionRange: sym.selectionRange };
      const inner = walk(sym.children, rest);
      if (inner) return inner;
    }
  }
  return undefined;
}
