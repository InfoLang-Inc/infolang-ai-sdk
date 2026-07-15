# InfoLang Chatbot Template

A minimal [Next.js](https://nextjs.org) App Router chat app that **remembers a
returning user across sessions**, powered by
[`@infolang/ai-sdk`](https://www.npmjs.com/package/@infolang/ai-sdk) and the
[Vercel AI SDK](https://sdk.vercel.ai).

The only InfoLang-specific code is one wrapped model in [`lib/model.ts`](./lib/model.ts):

```ts
import { wrapLanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { InfoLang } from "@infolang/sdk";
import { infolangMemoryMiddleware } from "@infolang/ai-sdk";

const model = wrapLanguageModel({
  model: openai("gpt-4o-mini"),
  middleware: infolangMemoryMiddleware({ client: new InfoLang(), namespace: userId }),
});
```

Everything else is a stock AI SDK chatbot: [`app/api/chat/route.ts`](./app/api/chat/route.ts)
calls `streamText`, and [`app/page.tsx`](./app/page.tsx) uses `useChat`.

## How memory works

- **Before generation**, the middleware recalls the user's most relevant
  memories and injects them into the system prompt.
- **After generation**, it stores the exchange so future turns can recall it.
- Each visitor gets a stable `il_uid` cookie ([`proxy.ts`](./proxy.ts))
  that becomes their InfoLang **namespace** (memory bank). Reads and writes are
  scoped to your API key's **workspace** (tenant).

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FInfoLang-Inc%2Finfolang-ai-sdk%2Ftree%2Fmain%2Ftemplate&env=OPENAI_API_KEY,INFOLANG_API_KEY&envDescription=Model%20provider%20key%20and%20InfoLang%20managed-cloud%20key&project-name=infolang-chatbot&repository-name=infolang-chatbot)

When importing, set the project **Root Directory** to `template/`, then provide:

| Variable           | Required | Notes                                         |
| ------------------ | -------- | --------------------------------------------- |
| `OPENAI_API_KEY`   | yes      | Or swap in any AI SDK provider in `lib/model.ts`. |
| `INFOLANG_API_KEY` | yes      | Managed-cloud key (`il_live_...`).            |
| `OPENAI_MODEL`     | no       | Defaults to `gpt-4o-mini`.                    |
| `INFOLANG_WORKSPACE` | no     | Target a specific workspace/tenant.           |

## Run locally

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
```

Open http://localhost:3000, tell the bot a fact about yourself, reload the page
(or return the next day), and ask it back.

> Verified against `ai@^7`, `@ai-sdk/react@^4`, `@ai-sdk/openai@^4`,
> `next@^16`, and `@infolang/sdk@^0.2`.
