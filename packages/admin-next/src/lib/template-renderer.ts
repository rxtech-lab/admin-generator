// Client-side evaluator for Go-template-style column valueFrom expressions,
// e.g. "{{.Author.Name}}". Field lookups are case-insensitive so templates
// authored against Go field names work on JSON (camelCase) data.
//
// Ported from smart-wallet-server-admin/src/lib/template-renderer.ts.

const TEMPLATE_RE = /\{\{\s*\.([^}]+?)\s*\}\}/g;

function lookup(data: unknown, path: string): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const obj = current as Record<string, unknown>;
    // Exact match first, then case-insensitive.
    if (part in obj) {
      current = obj[part];
      continue;
    }
    const key = Object.keys(obj).find(
      (k) => k.toLowerCase() === part.toLowerCase(),
    );
    current = key ? obj[key] : undefined;
  }
  return current;
}

/**
 * Render a Go-template value string against a row object. Returns the raw value
 * when the whole string is a single `{{.X}}` reference (preserving type), or an
 * interpolated string otherwise.
 */
export function renderTemplate(template: string, data: unknown): unknown {
  const single = template.match(/^\{\{\s*\.([^}]+?)\s*\}\}$/);
  if (single && single[1]) {
    return lookup(data, single[1]);
  }
  return template.replace(TEMPLATE_RE, (_, path: string) => {
    const value = lookup(data, path);
    return value == null ? "" : String(value);
  });
}
