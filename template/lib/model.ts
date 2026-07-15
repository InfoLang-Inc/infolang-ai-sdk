import { openai } from "@ai-sdk/openai";
import { infolangMemoryMiddleware } from "@infolang/ai-sdk";
import { InfoLang } from "@infolang/sdk";
import { wrapLanguageModel, type LanguageModel } from "ai";

/**
 * Build a language model with InfoLang memory scoped to a single user.
 *
 * This is the *only* InfoLang-specific wiring in the app: wrap any AI SDK
 * model with `infolangMemoryMiddleware`, keyed by the user's namespace, and
 * every `generateText` / `streamText` call recalls that user's memory before
 * generating and remembers the exchange after.
 */
export function memoryModel(namespace: string): LanguageModel {
  return wrapLanguageModel({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    middleware: infolangMemoryMiddleware({
      // Credentials come from INFOLANG_API_KEY (+ optional INFOLANG_WORKSPACE).
      client: new InfoLang(),
      namespace,
    }),
  });
}
