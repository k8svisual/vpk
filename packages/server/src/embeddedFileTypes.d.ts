// Ambient types for `with { type: 'file' }` imports (server.ts's default-snapshot fixture, and
// webAssets.generated.ts's embedded web build) — tsc doesn't understand that Bun's `type: 'file'` import
// attribute changes a module's shape to a plain path string, so without this it falls back to inferring each
// extension's "normal" meaning (JSON content, a missing declaration for .svg/.css/etc.). Scoped to this
// package only (via tsconfig's "include": ["src"]) — packages/demo-data's genuine `import x from
// './template.json'` DATA imports live in a separate compilation and are unaffected.
declare module '*.snapshot.json' {
  const path: string;
  export default path;
}
declare module '*.css' {
  const path: string;
  export default path;
}
declare module '*.svg' {
  const path: string;
  export default path;
}
declare module '*.wav' {
  const path: string;
  export default path;
}
declare module '*.js' {
  const path: string;
  export default path;
}
