import { describe, expect, it } from "vitest";

import {
  buildExchangeMemory,
  DEFAULT_CONTEXT_HEADER,
  extractAssistantText,
  extractUserQuery,
  formatMemoryContext,
  injectMemoryContext,
  type GeneratedContent,
  type Prompt,
} from "../src/index.js";

describe("extractUserQuery", () => {
  it("returns text of the last user message, joining text parts", () => {
    const prompt: Prompt = [
      { role: "system", content: "be helpful" },
      { role: "user", content: [{ type: "text", text: "first" }] },
      {
        role: "assistant",
        content: [{ type: "text", text: "an earlier answer" }],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "line one" },
          { type: "text", text: "" },
          { type: "text", text: "line two" },
        ],
      },
    ];
    expect(extractUserQuery(prompt)).toBe("line one\nline two");
  });

  it("returns empty string when there is no user message", () => {
    const prompt: Prompt = [{ role: "system", content: "system only" }];
    expect(extractUserQuery(prompt)).toBe("");
  });
});

describe("extractAssistantText", () => {
  it("joins text parts and ignores non-text content", () => {
    const content: GeneratedContent[] = [
      { type: "text", text: "Hello" },
      { type: "reasoning", text: "internal thoughts" },
      { type: "text", text: "world" },
    ];
    expect(extractAssistantText(content)).toBe("Hello\nworld");
  });

  it("returns empty string for content with no text", () => {
    expect(extractAssistantText([])).toBe("");
  });
});

describe("formatMemoryContext", () => {
  it("returns empty string for no chunks", () => {
    expect(formatMemoryContext([])).toBe("");
  });

  it("renders chunks with scores under the default header", () => {
    const out = formatMemoryContext([
      { id: "a", text: "  alpha  ", score: 0.912 },
      { id: "b", text: "beta" },
    ]);
    expect(out).toContain(DEFAULT_CONTEXT_HEADER);
    expect(out).toContain("[1] (relevance 0.91) alpha");
    expect(out).toContain("[2] beta");
    expect(out).toContain("(End of recalled memory.)");
  });

  it("honors a custom header", () => {
    const out = formatMemoryContext([{ id: "a", text: "x", score: 0.5 }], {
      header: "MEMORY:",
    });
    expect(out.startsWith("MEMORY:\n")).toBe(true);
  });
});

describe("injectMemoryContext", () => {
  const base: Prompt = [
    { role: "user", content: [{ type: "text", text: "hi" }] },
  ];

  it("returns the prompt unchanged for empty context", () => {
    expect(injectMemoryContext(base, "")).toBe(base);
  });

  it("prepends a system message when none exists", () => {
    const out = injectMemoryContext(base, "CTX");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ role: "system", content: "CTX" });
    expect(out[1]).toBe(base[0]);
  });

  it("merges into a leading system message", () => {
    const prompt: Prompt = [
      { role: "system", content: "original" },
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ];
    const out = injectMemoryContext(prompt, "CTX");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ role: "system", content: "original\n\nCTX" });
  });
});

describe("buildExchangeMemory", () => {
  it("formats a complete exchange", () => {
    expect(buildExchangeMemory("  q  ", "  a  ")).toBe(
      "User asked: q\nAssistant answered: a",
    );
  });

  it("returns null when the user side is empty", () => {
    expect(buildExchangeMemory("   ", "answer")).toBeNull();
  });

  it("returns null when the assistant side is empty", () => {
    expect(buildExchangeMemory("question", "")).toBeNull();
  });
});
