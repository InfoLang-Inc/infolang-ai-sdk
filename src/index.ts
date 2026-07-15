/**
 * InfoLang for the Vercel AI SDK.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from "ai";
 * import { openai } from "@ai-sdk/openai";
 * import { InfoLang } from "@infolang/sdk";
 * import { infolangMemoryMiddleware } from "@infolang/ai-sdk";
 *
 * const model = wrapLanguageModel({
 *   model: openai("gpt-4o"),
 *   middleware: infolangMemoryMiddleware({ client: new InfoLang(), namespace: userId }),
 * });
 * ```
 */

export {
  infolangMemoryMiddleware,
  type InfolangMemoryOptions,
} from "./middleware.js";
export { infolangMemoryTools, type MemoryToolsOptions } from "./tools.js";
export {
  buildExchangeMemory,
  DEFAULT_CONTEXT_HEADER,
  extractAssistantText,
  extractUserQuery,
  formatMemoryContext,
  injectMemoryContext,
  type CallOptions,
  type FormatContextOptions,
  type GeneratedContent,
  type GenerateResult,
  type Prompt,
  type PromptMessage,
  type StreamPart,
  type StreamResult,
} from "./context.js";
export type {
  Chunk,
  MemoryChunk,
  MemoryClient,
  RecallOptions,
  RecallResult,
  RememberOptions,
  RememberResult,
} from "./types.js";
export { version } from "./version.js";
