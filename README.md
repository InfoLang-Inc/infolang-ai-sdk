# InfoLang for the Vercel AI SDK

[![npm](https://img.shields.io/npm/v/@infolang/ai-sdk.svg)](https://www.npmjs.com/package/@infolang/ai-sdk)

Give any [Vercel AI SDK](https://sdk.vercel.ai) model **long-term memory** with
one line. `@infolang/ai-sdk` is a `LanguageModelMiddleware` that recalls
relevant [InfoLang](https://infolang.ai) memory *before* generation and
remembers the exchange *after* — for both `generateText` and `streamText`,
with any provider. It also ships memory as AI SDK **tools** for agents that
decide when to read and write.

> Package: `@infolang/ai-sdk` (npm). Built on the published
> [`@infolang/sdk`](https://www.npmjs.com/package/@infolang/sdk) client — no
> HTTP, engine internals, or credentials are handled here.

## Install

```bash
npm install @infolang/ai-sdk @infolang/sdk ai
```

`ai` (`>=5 <8`) and `@infolang/sdk` (`^0.2`) are peer dependencies. Verified
against `ai@7` (the `LanguageModelMiddleware` / provider spec `v4` surface).

## Quickstart — middleware

Add memory to an otherwise unmodified AI SDK app by wrapping the model:

```ts
import { generateText, wrapLanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { InfoLang } from "@infolang/sdk";
import { infolangMemoryMiddleware } from "@infolang/ai-sdk";

const model = wrapLanguageModel({
  model: openai("gpt-4o"),
  middleware: infolangMemoryMiddleware({
    client: new InfoLang(),   // reads INFOLANG_API_KEY (+ optional workspace)
    namespace: userId,        // per-user memory bank
  }),
});

// First session:
await generateText({ model, prompt: "My favorite language is Rust." });

// A later session — the model recalls it:
const { text } = await generateText({ model, prompt: "What's my favorite language?" });
// → "Your favorite language is Rust."
```

- **Recall (before):** `transformParams` recalls the latest user turn's context
  and injects it as a system instruction (merging into an existing system
  message when present).
- **Remember (after):** `wrapGenerate` and `wrapStream` store the exchange.
- **Non-blocking by design:** a recall or remember failure never breaks
  generation — pass `onError` to observe failures.

## Quickstart — tools

For agents that call memory explicitly:

```ts
import { generateText } from "ai";
import { InfoLang } from "@infolang/sdk";
import { infolangMemoryTools } from "@infolang/ai-sdk";

const tools = infolangMemoryTools({ client: new InfoLang(), namespace: userId });

await generateText({
  model: openai("gpt-4o"),
  tools, // { recallMemory, saveMemory }
  prompt: "Remember that I prefer metric units, then answer in metric.",
});
```

## Options

`infolangMemoryMiddleware(options)`:

| Option          | Default    | Purpose                                             |
| --------------- | ---------- | --------------------------------------------------- |
| `client`        | —          | InfoLang client (or any `MemoryClient`).            |
| `namespace`     | client's   | Memory bank to read/write (e.g. a user id).         |
| `topK`          | `5`        | Max chunks to recall and inject.                    |
| `filters`       | —          | Structured filters forwarded to `recall`.           |
| `recall`        | `true`     | Recall + inject context before generation.          |
| `remember`      | `true`     | Remember the exchange after generation.             |
| `source`        | `"ai-sdk"` | `source` tag on remembered exchanges.               |
| `tags`          | —          | Tags on remembered exchanges.                       |
| `minScore`      | —          | Drop recalled chunks below this score.              |
| `header`        | built-in   | Heading placed above injected chunks.               |
| `formatContext` | built-in   | Override how chunks render into the prompt.         |
| `buildMemory`   | built-in   | Override what is stored (return falsy to skip).     |
| `onError`       | no-op      | Observe `recall` / `remember` failures.             |

### Scoping

Mirrors the InfoLang SDK semantics: the **workspace** (tenant) is fixed by the
client's credentials; **namespace** selects the bank on both reads and writes.
A managed API key honors `namespace` on recall and remember; a dev key is
namespace-pinned.

## Chatbot template

[`template/`](./template) is a minimal Next.js App Router chatbot that
remembers a returning user out of the box, with a one-click Vercel deploy
button. See [`template/README.md`](./template/README.md).

## Exports

- `infolangMemoryMiddleware(options)` → `LanguageModelMiddleware`
- `infolangMemoryTools(options)` → `{ recallMemory, saveMemory }`
- Pure helpers: `extractUserQuery`, `extractAssistantText`,
  `formatMemoryContext`, `injectMemoryContext`, `buildExchangeMemory`
- Types: `MemoryClient`, `MemoryChunk`, and the re-exported SDK types.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test        # vitest + coverage (offline; model and client are mocked)
npm run build   # tsup → ESM + CJS + d.ts
```

Set `INFOLANG_LIVE=1` to opt into live tests (none are wired by default; the
suite runs fully offline).

## License

Apache-2.0 © InfoLang, Inc.
