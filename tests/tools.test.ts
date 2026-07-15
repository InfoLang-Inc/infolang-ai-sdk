import { describe, expect, it } from "vitest";

import { infolangMemoryTools } from "../src/index.js";
import { FakeMemory, required } from "./helpers.js";

/** Build minimal, correctly-typed execution options for a tool's execute fn. */
function optionsFor<Fn extends (...args: never[]) => unknown>(): Parameters<Fn>[1] {
  return {
    toolCallId: "call-1",
    messages: [],
  } as unknown as Parameters<Fn>[1];
}

describe("infolangMemoryTools", () => {
  it("exposes recallMemory and saveMemory with schemas and descriptions", () => {
    const { recallMemory, saveMemory } = infolangMemoryTools({
      client: new FakeMemory(),
    });
    expect(typeof recallMemory.description).toBe("string");
    expect(recallMemory.inputSchema).toBeDefined();
    expect(typeof saveMemory.description).toBe("string");
    expect(saveMemory.inputSchema).toBeDefined();
  });

  it("recallMemory recalls with the default topK and maps chunks", async () => {
    const client = new FakeMemory({
      chunks: [
        { id: "1", text: "alpha", score: 0.9 },
        { id: "2", text: "beta" },
      ],
      weak: false,
    });
    const { recallMemory } = infolangMemoryTools({ client, namespace: "u1" });
    const execute = required(recallMemory.execute, "recall execute");

    const out = (await execute(
      { query: "search me" },
      optionsFor<typeof execute>(),
    )) as {
      weak: boolean;
      results: { id: string; text: string; score: number | null }[];
    };

    expect(client.recallCalls[0]).toEqual({
      query: "search me",
      options: { namespace: "u1", topK: 5 },
    });
    expect(out.weak).toBe(false);
    expect(out.results).toEqual([
      { id: "1", text: "alpha", score: 0.9 },
      { id: "2", text: "beta", score: null },
    ]);
  });

  it("recallMemory honors a per-call topK override", async () => {
    const client = new FakeMemory({ chunks: [] });
    const { recallMemory } = infolangMemoryTools({ client, topK: 5 });
    const execute = required(recallMemory.execute, "recall execute");

    await execute({ query: "q", topK: 2 }, optionsFor<typeof execute>());

    expect(client.recallCalls[0]?.options).toEqual({
      namespace: undefined,
      topK: 2,
    });
  });

  it("saveMemory remembers with source and default tags", async () => {
    const client = new FakeMemory();
    const { saveMemory } = infolangMemoryTools({
      client,
      namespace: "u1",
      source: "agent",
      tags: "default-tag",
    });
    const execute = required(saveMemory.execute, "save execute");

    const out = (await execute(
      { text: "the user likes tea" },
      optionsFor<typeof execute>(),
    )) as { saved: boolean; memoryId: string | null };

    expect(client.rememberCalls[0]).toEqual({
      text: "the user likes tea",
      options: { namespace: "u1", source: "agent", tags: "default-tag" },
    });
    expect(out).toEqual({ saved: true, memoryId: "mem_1" });
  });

  it("saveMemory honors per-call tags and returns null id when absent", async () => {
    const client = new FakeMemory();
    client.rememberResult = { namespace: "u1" };
    const { saveMemory } = infolangMemoryTools({ client });
    const execute = required(saveMemory.execute, "save execute");

    const out = (await execute(
      { text: "fact", tags: "custom" },
      optionsFor<typeof execute>(),
    )) as { saved: boolean; memoryId: string | null };

    expect(client.rememberCalls[0]?.options).toEqual({
      namespace: undefined,
      source: "ai-sdk-tool",
      tags: "custom",
    });
    expect(out.memoryId).toBeNull();
  });
});
