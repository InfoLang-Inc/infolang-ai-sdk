/**
 * Memory as AI SDK tools, for agents that decide *when* to read and write
 * memory (as opposed to the always-on middleware).
 *
 * `infolangMemoryTools({ client })` returns a `ToolSet` with two tools:
 *
 * - `recallMemory` — semantic search over the user's memory bank.
 * - `saveMemory` — persist a durable fact for future recall.
 *
 * ```ts
 * import { generateText } from "ai";
 * import { InfoLang } from "@infolang/sdk";
 * import { infolangMemoryTools } from "@infolang/ai-sdk";
 *
 * const { recallMemory, saveMemory } = infolangMemoryTools({
 *   client: new InfoLang(),
 *   namespace: userId,
 * });
 *
 * await generateText({ model, tools: { recallMemory, saveMemory }, prompt });
 * ```
 *
 * Input schemas use the AI SDK's `jsonSchema` so the tools carry no extra
 * schema-library dependency for consumers.
 */

import { jsonSchema, tool } from "ai";

import type { MemoryClient } from "./types.js";

export interface MemoryToolsOptions {
  /** InfoLang client (or any compatible `MemoryClient`). */
  client: MemoryClient;
  /** Memory bank to read from and write to. */
  namespace?: string;
  /** Default max results for `recallMemory`. Default `5`. */
  topK?: number;
  /** `source` tag applied by `saveMemory`. Default `"ai-sdk-tool"`. */
  source?: string;
  /** Default tags applied by `saveMemory`. */
  tags?: string;
}

interface RecallToolInput {
  query: string;
  topK?: number;
}

interface SaveToolInput {
  text: string;
  tags?: string;
}

export function infolangMemoryTools(options: MemoryToolsOptions) {
  const { client, namespace, topK = 5, source = "ai-sdk-tool", tags } = options;

  const recallMemory = tool({
    description:
      "Search long-term semantic memory for context relevant to a query. " +
      "Call this before answering when the user refers to earlier facts, " +
      "preferences, decisions, or prior conversations.",
    inputSchema: jsonSchema<RecallToolInput>({
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "What to search memory for.",
        },
        topK: {
          type: "number",
          description: "Maximum number of memories to return.",
        },
      },
    }),
    execute: async ({ query, topK: limit }: RecallToolInput) => {
      const result = await client.recall(query, {
        namespace,
        topK: limit ?? topK,
      });
      return {
        weak: result.weak,
        results: result.chunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
          score: chunk.score ?? null,
        })),
      };
    },
  });

  const saveMemory = tool({
    description:
      "Save a durable fact to long-term memory so it can be recalled in " +
      "future conversations. Use for stable user preferences, decisions, and " +
      "important facts — not ephemeral chatter.",
    inputSchema: jsonSchema<SaveToolInput>({
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: {
          type: "string",
          description: "The fact to remember, as a self-contained sentence.",
        },
        tags: {
          type: "string",
          description: "Optional comma-separated tags.",
        },
      },
    }),
    execute: async ({ text, tags: itemTags }: SaveToolInput) => {
      const result = await client.remember(text, {
        namespace,
        source,
        tags: itemTags ?? tags,
      });
      return { saved: true, memoryId: result.memoryId ?? null };
    },
  });

  return { recallMemory, saveMemory };
}
