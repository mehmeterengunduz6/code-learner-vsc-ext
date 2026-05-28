export const RULE_BODY = `# Code Learner Notes — Project Rule

This workspace uses the **Code Learner** VS Code extension. Whenever you create or modify a function/class/method — including small tweaks like styling, layout, copy, or constant changes — write or update its note in \`.codelearner/notes/<id>.json\`. One file per note. The user reads notes by hovering in the editor — never mention notes work in your replies.

The hover only shows the *latest* \`**Changed in this edit:**\` entry, so it stays compact even after many small edits. Full history is visible in the side panel. This means you should not hesitate to record minor changes — they will not bloat the hover.

## Note file format

Each note lives in its own file at \`.codelearner/notes/<uuid>.json\`:

\`\`\`json
{
  "id": "uuid-v4",
  "file": "src/foo.ts",
  "anchors": {
    "symbol": "MyClass.method",
    "contentHash": "sha256-of-block-text",
    "fuzzyContext": { "before": "", "block": "", "after": "" }
  },
  "content": {
    "explanation": "1-3 plain sentences. What does this code do?",
    "reasoning":   "1-2 sentences. Why this approach? Real tradeoff, no platitudes.",
    "reviewQuestions": [
      { "q": "Why not <obvious alternative>?", "a": "1-2 sentence answer." }
    ],
    "conceptTags": ["use-state", "debounce"]
  },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "agent": "AGENT_ID",
  "state": "active"
}
\`\`\`

All fields required. \`contentHash\` = sha256 of the block source after trimming outer whitespace and normalizing CRLF→LF. \`fuzzyContext\` snippets are up to 80/200/80 chars from current file text.

### Hashing the block — critical

The extension recomputes this hash on every edit and auto-orphans the note (no gutter highlight) if it doesn't match. Get this wrong and your note silently disappears from the UI.

- Hash the **entire** symbol body, from its declaration line through its **final** matching closing brace — *not* a slice you re-extracted with \`awk\`/\`grep\`/\`sed\`. Tools that stop at the first column-0 \`}\` will truncate any block that contains nested \`function (){}\`, object literals, or JSX braces, producing a hash the resolver can never reproduce.
- Prefer hashing the exact text you just wrote to the file (the post-edit block contents), not a re-read shell extraction.
- Before hashing, normalize: \`text.replace(/\\r\\n/g, "\\n").replace(/^\\s+|\\s+$/g, "")\` — i.e. CRLF→LF, then trim leading/trailing whitespace only (do *not* touch interior whitespace).
- If you cannot reliably isolate the full block (large file, deeply nested), it is better to skip the note update than to write a wrong hash and orphan it.

## Workflow

1. For each created/edited block, compute the canonical \`symbol\` (e.g. \`Class.method\`, \`topLevelFn\`, or \`<parent>.<kebab-label>\` for unnamed regions).
2. Look in \`.codelearner/notes/\` for a file whose JSON has matching \`file\` + \`anchors.symbol\`. If found, **update** it (keep \`id\`, \`createdAt\`; refresh \`content\`, \`contentHash\`, \`fuzzyContext\`, \`updatedAt\`). If not, **create** a new \`<uuid>.json\`.
3. If you deleted a block whose note exists, set its \`state\` to \`"orphaned"\`. Do not delete the file.
4. Touch only the note file(s) you changed this turn. Never rewrite unrelated notes.

## Content rules (short, simple, plain)

- **Caps:** \`explanation\` ≤ 400 chars. \`reasoning\` ≤ 300 chars. Aim well under.
- **Language:** short sentences, plain words. Gloss jargon in 3-5 words on first use. No filler ("essentially", "basically").
- \`explanation\` = what the code does, in 1-3 sentences. Not a step-by-step walkthrough.
- \`reasoning\` = why, in 1-2 sentences. Name the real tradeoff or constraint.
- **On edits:** \`reasoning\` MUST start with one line \`**Changed in this edit:** …\` stating what changed and why. Keep previous reasoning below it. Newest on top. \`explanation\` describes the *current* code only.
- Inline \`code\` is fine. No headings (\`#\`). No code blocks. No \`// @learn\` or \`# note:\` comments in source.

## Review questions

- Write 2-3 \`reviewQuestions\` per note — the questions a senior reviewer is most likely to ask about *this specific block*. Each is a \`{ q, a }\` pair.
- Be specific to the code. Bad: "Is this clean?". Good: "Why a \`Map\` instead of a plain object?", "What happens if \`items\` is empty?", "Isn't this O(n²)?".
- \`q\` ≤ 200 chars, \`a\` ≤ 400 chars. Aim shorter. The point is to prime the user, not to write an essay.
- These are independent of the \`explanation\`/\`reasoning\` caps.

## Concept tags

- List up to 5 prerequisite concepts in \`conceptTags\` — short slugs (lowercase kebab-case) like \`use-state\`, \`debounce\`, \`closure\`, \`async-await\`.
- Tag only concepts the reader **must** know to follow the code. Don't tag everything.
- If you introduce a tag that has no definition yet, also write \`.codelearner/concepts/<slug>.md\` with a 2-4 sentence beginner-friendly definition (plain markdown, no frontmatter). Reuse existing concept files when the tag already has one.

## Silence rule

Note maintenance is invisible background work.
- Do not mention notes, IDs, or this rule in your reply, summaries, or "files changed" lists.
- Do not ask which fields to include or how to phrase a note. Decide silently.
- Do not mention "Code Learner", this extension, or the notes file inside \`content.explanation\` or \`content.reasoning\`. "Code Learner" is the extension, never the user's project — describe their code on its own terms.
- The extension auto-orphans notes whose \`contentHash\` no longer matches. You still own keeping notes up to date when you edit a block.
`;

export type RulePackFlavor = "claude" | "cursor" | "copilot";

export interface RulePackTarget {
  flavor: RulePackFlavor;
  label: string;
  relativePath: string;
  agentId: string;
}

export const RULE_PACK_TARGETS: Record<RulePackFlavor, RulePackTarget> = {
  claude: {
    flavor: "claude",
    label: "Claude Code (CLAUDE.md)",
    relativePath: "CLAUDE.md",
    agentId: "claude-code",
  },
  cursor: {
    flavor: "cursor",
    label: "Cursor (.cursorrules)",
    relativePath: ".cursorrules",
    agentId: "cursor",
  },
  copilot: {
    flavor: "copilot",
    label: "GitHub Copilot (.github/copilot-instructions.md)",
    relativePath: ".github/copilot-instructions.md",
    agentId: "copilot",
  },
};

export function renderRulePack(target: RulePackTarget): string {
  return RULE_BODY.replace("AGENT_ID", target.agentId);
}
