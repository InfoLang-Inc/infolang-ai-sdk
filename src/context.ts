/**
 * Pure, dependency-free helpers for reading and rewriting the AI SDK's
 * language-model prompt.
 *
 * The prompt/stream types are **derived from the installed `ai` package's
 * public `LanguageModelMiddleware` type** rather than hard-coded, so this file
 * tracks whatever provider spec version `ai` ships (verified against
 * `ai@7.0.28`, provider spec `v4`). Deriving from the middleware type keeps the
 * package correct across the AI SDK middleware changes that happened over
 * v3/v4/v5.
 */

import type { LanguageModelMiddleware } from "ai";

import type { MemoryChunk } from "./types.js";

type TransformParams = NonNullable<LanguageModelMiddleware["transformParams"]>;
type WrapGenerate = NonNullable<LanguageModelMiddleware["wrapGenerate"]>;
type WrapStream = NonNullable<LanguageModelMiddleware["wrapStream"]>;

/** The transformed call options passed through the middleware. */
export type CallOptions = Parameters<TransformParams>[0]["params"];
/** The standardized language-model prompt (an array of messages). */
export type Prompt = CallOptions["prompt"];
/** A single prompt message (system / user / assistant / tool). */
export type PromptMessage = Prompt[number];
/** The result of a non-streaming generation. */
export type GenerateResult = Awaited<
  ReturnType<Parameters<WrapGenerate>[0]["doGenerate"]>
>;
/** A single ordered content part produced by the model. */
export type GeneratedContent = GenerateResult["content"][number];
/** The result of a streaming generation. */
export type StreamResult = Awaited<
  ReturnType<Parameters<WrapStream>[0]["doStream"]>
>;
/** A single stream part emitted by the model. */
export type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

/** Content parts that may carry text (non-text parts simply lack `text`). */
type MaybeTextPart = { type: string; text?: string };

export const DEFAULT_CONTEXT_HEADER =
  "Relevant context from the user's InfoLang memory. Use it only when it helps answer; ignore anything irrelevant.";
const CONTEXT_FOOTER = "(End of recalled memory.)";

function collectText(parts: ReadonlyArray<MaybeTextPart>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && part.text) out.push(part.text);
  }
  return out.join("\n").trim();
}

/**
 * The recall query: the text of the most recent `user` message. Returns an
 * empty string when there is no user turn to key off.
 */
export function extractUserQuery(prompt: Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i -= 1) {
    const message = prompt[i];
    if (message?.role === "user") {
      return collectText(message.content);
    }
  }
  return "";
}

/** The assistant's text from a non-streaming generation result. */
export function extractAssistantText(
  content: ReadonlyArray<GeneratedContent>,
): string {
  return collectText(content as ReadonlyArray<MaybeTextPart>);
}

export interface FormatContextOptions {
  /** Heading placed above the recalled chunks. */
  header?: string;
}

/**
 * Render recalled chunks into a compact, model-friendly context block.
 * Returns an empty string when there is nothing to inject.
 */
export function formatMemoryContext(
  chunks: ReadonlyArray<MemoryChunk>,
  options: FormatContextOptions = {},
): string {
  if (chunks.length === 0) return "";
  const header = options.header ?? DEFAULT_CONTEXT_HEADER;
  const lines = chunks.map((chunk, index) => {
    const score =
      typeof chunk.score === "number" ? ` (relevance ${chunk.score.toFixed(2)})` : "";
    return `[${index + 1}]${score} ${chunk.text.trim()}`;
  });
  return `${header}\n${lines.join("\n")}\n${CONTEXT_FOOTER}`;
}

/**
 * Insert a context block as a system instruction. Merges into a leading
 * system message when present (so a single system turn is preserved for
 * providers that expect one), otherwise prepends a new system message.
 * Returns the prompt unchanged when `context` is empty.
 */
export function injectMemoryContext(prompt: Prompt, context: string): Prompt {
  if (!context) return prompt;
  const first = prompt[0];
  if (first?.role === "system") {
    const merged: PromptMessage = {
      ...first,
      content: `${first.content}\n\n${context}`,
    };
    return [merged, ...prompt.slice(1)];
  }
  const system: PromptMessage = { role: "system", content: context };
  return [system, ...prompt];
}

/**
 * The default memory text stored after an exchange. Returns `null` when
 * either side is empty (nothing worth remembering).
 */
export function buildExchangeMemory(
  user: string,
  assistant: string,
): string | null {
  const q = user.trim();
  const a = assistant.trim();
  if (!q || !a) return null;
  return `User asked: ${q}\nAssistant answered: ${a}`;
}
