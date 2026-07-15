/**
 * Opt-in live round-trip against a real InfoLang instance.
 *
 * Skipped by default; the rest of the suite is fully offline. Run with:
 *
 *   INFOLANG_LIVE=1 INFOLANG_API_KEY=il_live_... npm run test:live
 *
 * Only an InfoLang credential is needed — the model is still mocked, so no
 * model-provider key or network model call is required.
 */

import { generateText, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { InfoLang } from "@infolang/sdk";

import { infolangMemoryMiddleware } from "../src/index.js";
import { generateResult } from "./helpers.js";

const live = process.env.INFOLANG_LIVE === "1";

describe.skipIf(!live)("live round-trip (INFOLANG_LIVE=1)", () => {
  it("remembers an exchange and recalls it from the same namespace", async () => {
    const namespace = `ai-sdk-test-${Date.now()}`;
    const client = new InfoLang(); // creds from INFOLANG_API_KEY / INFOLANG_DEV_KEY
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: generateResult("Your favorite language is Rust."),
      }),
      middleware: infolangMemoryMiddleware({ client, namespace }),
    });

    await generateText({ model, prompt: "My favorite language is Rust." });

    const recalled = await client.recall("what is my favorite language", {
      namespace,
      topK: 5,
    });
    expect(recalled.chunks.some((chunk) => /rust/i.test(chunk.text))).toBe(true);
  });
});
