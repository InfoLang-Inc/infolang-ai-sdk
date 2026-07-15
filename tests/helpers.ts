/** Shared test fixtures: a recording fake memory client and typed builders. */

import type {
  GenerateResult,
  MemoryClient,
  Prompt,
  RecallOptions,
  RecallResult,
  RememberOptions,
  RememberResult,
  StreamPart,
  StreamResult,
} from "../src/index.js";

/** A `MemoryClient` that records calls and returns canned results. */
export class FakeMemory implements MemoryClient {
  readonly recallCalls: { query: string; options?: RecallOptions }[] = [];
  readonly rememberCalls: { text: string; options?: RememberOptions }[] = [];
  recallResult: RecallResult;
  rememberResult: RememberResult = { memoryId: "mem_1", namespace: "default" };
  recallError?: Error;
  rememberError?: Error;

  constructor(recallResult: Partial<RecallResult> = {}) {
    this.recallResult = { chunks: [], weak: false, ...recallResult };
  }

  async recall(query: string, options?: RecallOptions): Promise<RecallResult> {
    this.recallCalls.push({ query, options });
    if (this.recallError) throw this.recallError;
    return this.recallResult;
  }

  async remember(
    text: string,
    options?: RememberOptions,
  ): Promise<RememberResult> {
    this.rememberCalls.push({ text, options });
    if (this.rememberError) throw this.rememberError;
    return this.rememberResult;
  }
}

/** Assert a value is defined (avoids non-null assertions in tests). */
export function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`expected ${name} to be defined`);
  return value;
}

const USAGE: GenerateResult["usage"] = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const FINISH: GenerateResult["finishReason"] = { unified: "stop", raw: "stop" };

/** A single user-turn prompt with the given text. */
export function userPrompt(text: string): Prompt {
  return [{ role: "user", content: [{ type: "text", text }] }];
}

/** A prompt with only a system message (no user turn to recall on). */
export function systemOnlyPrompt(): Prompt {
  return [{ role: "system", content: "system only" }];
}

/** A valid non-streaming generate result whose only content is `text`. */
export function generateResult(text: string): GenerateResult {
  return {
    content: text ? [{ type: "text", text }] : [],
    finishReason: FINISH,
    usage: USAGE,
    warnings: [],
  };
}

/** Text stream parts that emit `text` as two deltas. */
export function textStreamParts(text: string): StreamPart[] {
  const mid = Math.ceil(text.length / 2);
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    { type: "text-delta", id: "1", delta: text.slice(0, mid) },
    { type: "text-delta", id: "1", delta: text.slice(mid) },
    { type: "text-end", id: "1" },
    { type: "finish", finishReason: FINISH, usage: USAGE },
  ];
}

/** A streaming result whose readable emits the given parts. */
export function streamResult(parts: StreamPart[]): StreamResult {
  return {
    stream: new ReadableStream<StreamPart>({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

/** Drain a readable stream to an array. */
export async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const out: T[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}
