# Changelog

All notable changes to `@infolang/ai-sdk` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- `infolangMemoryMiddleware(options)` — a Vercel AI SDK
  `LanguageModelMiddleware` that recalls InfoLang memory into the prompt
  before generation (`transformParams`) and remembers the exchange after
  generation (`wrapGenerate`) and streaming (`wrapStream`).
- `infolangMemoryTools({ client })` — `recallMemory` and `saveMemory`
  `tool()` definitions for tool-calling agents.
- Pure, exported helpers: `extractUserQuery`, `extractAssistantText`,
  `formatMemoryContext`, `injectMemoryContext`, `buildExchangeMemory`.
- Structural `MemoryClient` contract satisfied by `@infolang/sdk`'s
  `InfoLang` client (recall/remember).
- Next.js App Router chatbot template under `template/` with a Vercel
  one-click deploy button.

Verified against `ai@7.0.28` (`LanguageModelMiddleware` over the `v4`
provider spec) and `@infolang/sdk@0.2.1`.
