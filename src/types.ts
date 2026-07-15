/**
 * The memory contract this package depends on.
 *
 * We deliberately model a **structural** client rather than importing the
 * concrete `InfoLang` class, so the middleware never touches HTTP, engine
 * internals, or credentials directly — it only calls `recall`/`remember`.
 * The published `@infolang/sdk` `InfoLang` instance satisfies this interface
 * as-is, and the option/result types below are the SDK's own types so the
 * surface stays contract-aligned.
 */

import type {
  Chunk,
  RecallOptions,
  RecallResult,
  RememberOptions,
  RememberResult,
} from "@infolang/sdk";

export type {
  Chunk,
  RecallOptions,
  RecallResult,
  RememberOptions,
  RememberResult,
};

/** A single recalled memory chunk (the SDK's normalized shape). */
export type MemoryChunk = Chunk;

/**
 * The minimal slice of the InfoLang SDK the middleware needs. `InfoLang`
 * (and any compatible mock) satisfies this structurally.
 *
 * Scoping mirrors the Python/TS SDK semantics: `namespace` selects the bank
 * on both reads and writes; the workspace (tenant) is fixed by the client's
 * credentials. A managed API key honors `namespace` on recall and remember;
 * a dev key is namespace-pinned.
 */
export interface MemoryClient {
  recall(query: string, options?: RecallOptions): Promise<RecallResult>;
  remember(text: string, options?: RememberOptions): Promise<RememberResult>;
}
