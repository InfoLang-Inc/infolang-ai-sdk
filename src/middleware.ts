/**
 * `infolangMemoryMiddleware` — a Vercel AI SDK `LanguageModelMiddleware` that
 * gives any wrapped model long-term memory:
 *
 * - `transformParams` recalls relevant InfoLang memory for the latest user
 *   turn and injects it as system context **before** generation.
 * - `wrapGenerate` / `wrapStream` remember the exchange **after** generation,
 *   for both non-streaming and streaming calls.
 *
 * Wrap a model with the AI SDK's `wrapLanguageModel`:
 *
 * ```ts
 * import { wrapLanguageModel } from "ai";
 * import { openai } from "@ai-sdk/openai";
 * import { InfoLang } from "@infolang/sdk";
 * import { infolangMemoryMiddleware } from "@infolang/ai-sdk";
 *
 * const model = wrapLanguageModel({
 *   model: openai("gpt-4o"),
 *   middleware: infolangMemoryMiddleware({
 *     client: new InfoLang(),
 *     namespace: userId, // per-user memory bank
 *   }),
 * });
 * ```
 *
 * Memory is best-effort: a recall or remember failure never breaks generation.
 * Failures are routed to `onError` (a no-op by default).
 */

import type { LanguageModelMiddleware } from "ai";

import {
  buildExchangeMemory,
  extractAssistantText,
  extractUserQuery,
  formatMemoryContext,
  injectMemoryContext,
  type StreamPart,
} from "./context.js";
import type { MemoryChunk, MemoryClient } from "./types.js";

export interface InfolangMemoryOptions {
  /** InfoLang client (or any compatible `MemoryClient`). */
  client: MemoryClient;
  /**
   * Memory bank to read from and write to. Typically a per-user id. When
   * omitted, the client's default namespace (or credentials) decide.
   */
  namespace?: string;
  /** Max chunks to recall and inject. Default `5`. */
  topK?: number;
  /** Optional structured filters forwarded to `recall`. */
  filters?: Record<string, unknown>;
  /** Recall + inject context before generation. Default `true`. */
  recall?: boolean;
  /** Remember the exchange after generation. Default `true`. */
  remember?: boolean;
  /** `source` tag applied to remembered exchanges. Default `"ai-sdk"`. */
  source?: string;
  /** Optional comma-separated tags applied to remembered exchanges. */
  tags?: string;
  /** Drop recalled chunks scoring below this threshold before injecting. */
  minScore?: number;
  /** Heading placed above injected chunks. */
  header?: string;
  /** Override how recalled chunks are rendered into the prompt. */
  formatContext?: (chunks: MemoryChunk[]) => string;
  /**
   * Override what gets stored for an exchange. Return a falsy value to skip
   * remembering this turn.
   */
  buildMemory?: (exchange: {
    user: string;
    assistant: string;
  }) => string | null | undefined;
  /** Observe recall/remember failures (which are otherwise swallowed). */
  onError?: (error: unknown, phase: "recall" | "remember") => void;
}

export function infolangMemoryMiddleware(
  options: InfolangMemoryOptions,
): LanguageModelMiddleware {
  const {
    client,
    namespace,
    topK = 5,
    filters,
    recall = true,
    remember = true,
    source = "ai-sdk",
    tags,
    minScore,
    header,
    formatContext,
    buildMemory,
    onError,
  } = options;

  const handleError = (error: unknown, phase: "recall" | "remember"): void => {
    onError?.(error, phase);
  };

  const rememberExchange = async (
    user: string,
    assistant: string,
  ): Promise<void> => {
    const text = buildMemory
      ? buildMemory({ user, assistant })
      : buildExchangeMemory(user, assistant);
    if (!text) return;
    try {
      await client.remember(text, { namespace, source, tags });
    } catch (error) {
      handleError(error, "remember");
    }
  };

  return {
    async transformParams({ params }) {
      if (!recall) return params;
      const query = extractUserQuery(params.prompt);
      if (!query) return params;
      try {
        const result = await client.recall(query, { namespace, topK, filters });
        const chunks =
          typeof minScore === "number"
            ? result.chunks.filter((chunk) => (chunk.score ?? 0) >= minScore)
            : result.chunks;
        if (chunks.length === 0) return params;
        const context = formatContext
          ? formatContext(chunks)
          : formatMemoryContext(chunks, { header });
        if (!context) return params;
        return { ...params, prompt: injectMemoryContext(params.prompt, context) };
      } catch (error) {
        handleError(error, "recall");
        return params;
      }
    },

    async wrapGenerate({ doGenerate, params }) {
      const result = await doGenerate();
      if (remember) {
        await rememberExchange(
          extractUserQuery(params.prompt),
          extractAssistantText(result.content),
        );
      }
      return result;
    },

    async wrapStream({ doStream, params }) {
      const result = await doStream();
      if (!remember) return result;
      const user = extractUserQuery(params.prompt);
      let assistant = "";
      const capture = new TransformStream<StreamPart, StreamPart>({
        transform(chunk, controller) {
          if (chunk.type === "text-delta") assistant += chunk.delta;
          controller.enqueue(chunk);
        },
        async flush() {
          await rememberExchange(user, assistant);
        },
      });
      return { ...result, stream: result.stream.pipeThrough(capture) };
    },
  };
}
