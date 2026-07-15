# infolang-ai-sdk — agent instructions

InfoLang integration for the **Vercel AI SDK**. Package name: `@infolang/ai-sdk`.
A `LanguageModelMiddleware` (+ memory tools) layered on the published
`@infolang/sdk` client. No HTTP, no engine internals, no credentials here.

## Architecture

- `src/middleware.ts` — `infolangMemoryMiddleware`: `transformParams` (recall +
  inject before), `wrapGenerate` / `wrapStream` (remember after).
- `src/tools.ts` — `infolangMemoryTools`: `recallMemory` / `saveMemory` `tool()`s.
- `src/context.ts` — pure prompt helpers. Prompt/stream types are **derived
  from the installed `ai` package's `LanguageModelMiddleware`**, not hard-coded.
- `src/types.ts` — the structural `MemoryClient` contract (satisfied by
  `@infolang/sdk`'s `InfoLang`) and re-exported SDK types.

## Contract (frozen)

- Depend only on the **published** `@infolang/sdk` (`^0.2`). Never reimplement
  HTTP, import runtime/engine internals, or reference core-ip.
- The AI SDK middleware API changed across v3/v4/v5. **Verify the interface
  against the actually-installed `ai` version** — do not assume. Current:
  `ai@7`, provider spec `v4`, `LanguageModelMiddleware` + `wrapLanguageModel`.
- Cite the OpenAPI/SDK surface for behavior, never engine internals.

## Rules

- Zero runtime dependencies. `ai` and `@infolang/sdk` are **peers**; import only
  types from them in library code (erased at build).
- Memory is best-effort: recall/remember failures must never break generation.
- Keep `src/version.ts` in sync with `package.json`.
- `template/` is excluded from the package, typecheck, lint, and tests.

## Commands

```bash
npm install
npm run lint && npm run typecheck && npm test && npm run build
```
