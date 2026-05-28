const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const ctx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};

(async () => {
  if (watch) {
    const context = await esbuild.context(ctx);
    await context.watch();
  } else {
    await esbuild.build(ctx);
  }
})().catch(() => process.exit(1));
