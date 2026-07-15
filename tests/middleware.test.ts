import { generateText, streamText, wrapLanguageModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import { infolangMemoryMiddleware } from "../src/index.js";
import {
  drain,
  FakeMemory,
  generateResult,
  required,
  streamResult,
  systemOnlyPrompt,
  textStreamParts,
  userPrompt,
} from "./helpers.js";

const model = new MockLanguageModelV4();

function transformParamsOf(client: FakeMemory, options = {}) {
  const mw = infolangMemoryMiddleware({ client, ...options });
  return required(mw.transformParams, "transformParams");
}

describe("transformParams (recall + inject)", () => {
  it("recalls the last user turn and injects context as a system message", async () => {
    const client = new FakeMemory({
      chunks: [{ id: "1", text: "user's name is Ada", score: 0.95 }],
    });
    const transformParams = transformParamsOf(client, {
      namespace: "user-1",
      topK: 3,
      filters: { kind: "fact" },
    });

    const out = await transformParams({
      type: "generate",
      params: { prompt: userPrompt("what is my name?") },
      model,
    });

    expect(client.recallCalls).toHaveLength(1);
    expect(client.recallCalls[0]).toEqual({
      query: "what is my name?",
      options: { namespace: "user-1", topK: 3, filters: { kind: "fact" } },
    });
    const first = required(out.prompt[0], "system message");
    expect(first.role).toBe("system");
    expect(first.role === "system" && first.content).toContain(
      "user's name is Ada",
    );
  });

  it("does not recall or change params when recall is disabled", async () => {
    const client = new FakeMemory();
    const transformParams = transformParamsOf(client, { recall: false });
    const params = { prompt: userPrompt("hello") };

    const out = await transformParams({ type: "generate", params, model });

    expect(out).toBe(params);
    expect(client.recallCalls).toHaveLength(0);
  });

  it("skips recall when there is no user query", async () => {
    const client = new FakeMemory();
    const transformParams = transformParamsOf(client);
    const params = { prompt: systemOnlyPrompt() };

    const out = await transformParams({ type: "generate", params, model });

    expect(out).toBe(params);
    expect(client.recallCalls).toHaveLength(0);
  });

  it("does not inject when recall returns no chunks", async () => {
    const client = new FakeMemory({ chunks: [] });
    const transformParams = transformParamsOf(client);
    const params = { prompt: userPrompt("q") };

    const out = await transformParams({ type: "generate", params, model });

    expect(out).toBe(params);
  });

  it("drops chunks below minScore and injects the rest", async () => {
    const client = new FakeMemory({
      chunks: [
        { id: "1", text: "strong", score: 0.9 },
        { id: "2", text: "weak", score: 0.3 },
        { id: "3", text: "unscored" },
      ],
    });
    const transformParams = transformParamsOf(client, { minScore: 0.85 });

    const out = await transformParams({
      type: "generate",
      params: { prompt: userPrompt("q") },
      model,
    });

    const system = required(out.prompt[0], "system");
    const content = system.role === "system" ? system.content : "";
    expect(content).toContain("strong");
    expect(content).not.toContain("weak");
    expect(content).not.toContain("unscored");
  });

  it("does not inject when minScore filters out everything", async () => {
    const client = new FakeMemory({
      chunks: [{ id: "1", text: "weak", score: 0.3 }],
    });
    const transformParams = transformParamsOf(client, { minScore: 0.85 });
    const params = { prompt: userPrompt("q") };

    const out = await transformParams({ type: "generate", params, model });

    expect(out).toBe(params);
  });

  it("uses a custom formatContext and skips injection when it is empty", async () => {
    const client = new FakeMemory({ chunks: [{ id: "1", text: "x" }] });
    const formatted = transformParamsOf(client, {
      formatContext: () => "CUSTOM CONTEXT",
    });
    const withContext = await formatted({
      type: "generate",
      params: { prompt: userPrompt("q") },
      model,
    });
    const system = required(withContext.prompt[0], "system");
    expect(system.role === "system" && system.content).toBe("CUSTOM CONTEXT");

    const emptyFormat = transformParamsOf(client, { formatContext: () => "" });
    const params = { prompt: userPrompt("q") };
    const unchanged = await emptyFormat({ type: "generate", params, model });
    expect(unchanged).toBe(params);
  });

  it("swallows recall errors and reports them to onError", async () => {
    const client = new FakeMemory();
    client.recallError = new Error("recall boom");
    const onError = vi.fn();
    const transformParams = transformParamsOf(client, { onError });
    const params = { prompt: userPrompt("q") };

    const out = await transformParams({ type: "generate", params, model });

    expect(out).toBe(params);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "recall");
  });

  it("swallows recall errors even without an onError handler", async () => {
    const client = new FakeMemory();
    client.recallError = new Error("recall boom");
    const transformParams = transformParamsOf(client);
    const params = { prompt: userPrompt("q") };

    await expect(
      transformParams({ type: "generate", params, model }),
    ).resolves.toBe(params);
  });
});

describe("wrapGenerate (remember)", () => {
  it("remembers the exchange with namespace, source, and tags", async () => {
    const client = new FakeMemory();
    const mw = infolangMemoryMiddleware({
      client,
      namespace: "user-1",
      source: "chat",
      tags: "session:42",
    });
    const wrapGenerate = required(mw.wrapGenerate, "wrapGenerate");

    const result = await wrapGenerate({
      doGenerate: async () => generateResult("Your name is Ada."),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("what is my name?") },
      model,
    });

    expect(result.content).toEqual([
      { type: "text", text: "Your name is Ada." },
    ]);
    expect(client.rememberCalls).toHaveLength(1);
    expect(client.rememberCalls[0]).toEqual({
      text: "User asked: what is my name?\nAssistant answered: Your name is Ada.",
      options: { namespace: "user-1", source: "chat", tags: "session:42" },
    });
  });

  it("does not remember when remember is disabled", async () => {
    const client = new FakeMemory();
    const mw = infolangMemoryMiddleware({ client, remember: false });
    const wrapGenerate = required(mw.wrapGenerate, "wrapGenerate");

    await wrapGenerate({
      doGenerate: async () => generateResult("hi"),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("q") },
      model,
    });

    expect(client.rememberCalls).toHaveLength(0);
  });

  it("skips remembering when the assistant produced no text", async () => {
    const client = new FakeMemory();
    const mw = infolangMemoryMiddleware({ client });
    const wrapGenerate = required(mw.wrapGenerate, "wrapGenerate");

    await wrapGenerate({
      doGenerate: async () => generateResult(""),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("q") },
      model,
    });

    expect(client.rememberCalls).toHaveLength(0);
  });

  it("uses a custom buildMemory and skips when it returns null", async () => {
    const client = new FakeMemory();
    const custom = infolangMemoryMiddleware({
      client,
      buildMemory: ({ user, assistant }) => `Q:${user} A:${assistant}`,
    });
    const wrapCustom = required(custom.wrapGenerate, "wrapGenerate");
    await wrapCustom({
      doGenerate: async () => generateResult("a"),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("q") },
      model,
    });
    expect(client.rememberCalls[0]?.text).toBe("Q:q A:a");

    const skip = infolangMemoryMiddleware({ client, buildMemory: () => null });
    const wrapSkip = required(skip.wrapGenerate, "wrapGenerate");
    await wrapSkip({
      doGenerate: async () => generateResult("a"),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("q") },
      model,
    });
    expect(client.rememberCalls).toHaveLength(1);
  });

  it("swallows remember errors and reports them to onError", async () => {
    const client = new FakeMemory();
    client.rememberError = new Error("remember boom");
    const onError = vi.fn();
    const mw = infolangMemoryMiddleware({ client, onError });
    const wrapGenerate = required(mw.wrapGenerate, "wrapGenerate");

    const result = await wrapGenerate({
      doGenerate: async () => generateResult("hi"),
      doStream: async () => streamResult([]),
      params: { prompt: userPrompt("q") },
      model,
    });

    expect(result.content).toEqual([{ type: "text", text: "hi" }]);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "remember");
  });
});

describe("wrapStream (remember after streaming)", () => {
  it("passes stream parts through unchanged and remembers accumulated text", async () => {
    const client = new FakeMemory();
    const mw = infolangMemoryMiddleware({ client, namespace: "user-1" });
    const wrapStream = required(mw.wrapStream, "wrapStream");

    const result = await wrapStream({
      doGenerate: async () => generateResult(""),
      doStream: async () => streamResult(textStreamParts("Hello world")),
      params: { prompt: userPrompt("greet me") },
      model,
    });

    const parts = await drain(result.stream);
    const deltas = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p.type === "text-delta" ? p.delta : ""));
    expect(deltas.join("")).toBe("Hello world");
    expect(client.rememberCalls).toHaveLength(1);
    expect(client.rememberCalls[0]).toEqual({
      text: "User asked: greet me\nAssistant answered: Hello world",
      options: { namespace: "user-1", source: "ai-sdk", tags: undefined },
    });
  });

  it("returns the original stream and does not remember when disabled", async () => {
    const client = new FakeMemory();
    const mw = infolangMemoryMiddleware({ client, remember: false });
    const wrapStream = required(mw.wrapStream, "wrapStream");
    const original = streamResult(textStreamParts("hi"));

    const result = await wrapStream({
      doGenerate: async () => generateResult(""),
      doStream: async () => original,
      params: { prompt: userPrompt("q") },
      model,
    });

    expect(result).toBe(original);
    await drain(result.stream);
    expect(client.rememberCalls).toHaveLength(0);
  });
});

describe("integration with wrapLanguageModel", () => {
  it("adds memory to generateText with only the middleware line", async () => {
    const client = new FakeMemory({
      chunks: [{ id: "1", text: "the user's name is Ada", score: 0.95 }],
    });
    const wrapped = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: generateResult("Your name is Ada."),
      }),
      middleware: infolangMemoryMiddleware({ client, namespace: "user-1" }),
    });

    const result = await generateText({
      model: wrapped,
      prompt: "What is my name?",
    });

    expect(result.text).toBe("Your name is Ada.");
    expect(client.recallCalls[0]?.query).toBe("What is my name?");
    expect(client.rememberCalls[0]?.text).toContain(
      "User asked: What is my name?",
    );
  });

  it("adds memory to streamText", async () => {
    const client = new FakeMemory({
      chunks: [{ id: "1", text: "the user prefers dark mode", score: 0.9 }],
    });
    const wrapped = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doStream: streamResult(textStreamParts("Noted.")),
      }),
      middleware: infolangMemoryMiddleware({ client, namespace: "user-1" }),
    });

    const result = streamText({ model: wrapped, prompt: "Remember my theme." });
    await result.consumeStream();

    expect(await result.text).toBe("Noted.");
    expect(client.recallCalls[0]?.query).toBe("Remember my theme.");
    expect(client.rememberCalls[0]?.text).toContain(
      "Assistant answered: Noted.",
    );
  });
});
