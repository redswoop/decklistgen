import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wrap a value as a CallToolResult with a single JSON text block. */
export function asJson(value: unknown, isError = false): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    isError,
  };
}

/** Wrap a plain text message as a CallToolResult. */
export function asText(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

/** Wrap an image blob (base64) as a CallToolResult. */
export function asImage(base64: string, mimeType: string): CallToolResult {
  return {
    content: [
      {
        type: "image",
        data: base64,
        mimeType,
      },
    ],
  };
}
