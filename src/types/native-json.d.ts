// Node 24 supports these APIs. Stable TypeScript 7.0.2 has no matching lib yet.
// Remove this compatibility declaration when upgrading to TypeScript 7.1+ and
// enabling its ES2026 JSON declarations.
// https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/
declare global {
  interface JSON {
    rawJSON(text: string): { readonly rawJSON: string }
    isRawJSON(value: unknown): value is { readonly rawJSON: string }
  }
}

export {}
