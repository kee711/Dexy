import type { RawResponse } from "./types.ts";

export function safeJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function serializeAnswer(r: RawResponse): string {
  return JSON.stringify(r.data, null, 2);
}
