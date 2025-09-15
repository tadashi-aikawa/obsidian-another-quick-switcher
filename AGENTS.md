# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (TypeScript). UI modals in `src/ui/`, utilities in `src/utils/`, core plugin in `src/main.ts`.
- Tests: colocated `*.test.ts` beside sources (e.g., `src/utils/strings.test.ts`).
- Build artifacts: `main.js`, `styles.css`, `manifest*.json` at repo root.
- Assets/demos: `demo/`.

## Build, Test, and Development Commands
- Install: `bun i` (Bun required).
- Develop: `bun dev` — builds, watches, and copies files to your Obsidian vault.
  - Update `VAULT_DIR` in `esbuild.config.mts` to your local vault path.
- Build: `bun run build` — type-checks with `tsc` and produces `main.js`.
- Test: `bun run test` — runs Jest (`esbuild-jest` transformer).
- Lint: `bun run check` — Biome lint + organize imports (fixes in place).
- Format: `bun run format` — Biome formatter.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Indentation: spaces (Biome-managed).
- Files: utilities in kebab-case (e.g., `collection-helper.ts`); UI classes PascalCase inside (e.g., `AnotherQuickSwitcherModal`).
- Imports: organized by Biome; avoid unused imports and implicit `any` in app code.

## Testing Guidelines
- Framework: Jest with `esbuild-jest` for TS.
- Location: colocate tests as `*.test.ts` near sources.
- Scope: prioritize deterministic tests for `src/utils/*` and logic in `src/transformer.ts` and matchers/sorters.
- Run locally with `bun run test`; keep tests fast and isolated from Obsidian APIs.

## Commit & Pull Request Guidelines
- Hooks: enable repo hooks once per clone: `git config core.hooksPath hooks`.
- Commit format (enforced): `type(scope): description` (e.g., `feat(main): add fuzzy search`).
  - Types: `feat|fix|style|docs|refactor|test|ci|build|dev|chore`.
  - Scopes: `main|folder|header|backlink|link|in file|grep|move` (slash-separated for multiple).
- Pre-push runs type-check, lint, and tests: `bun pre:push`.
- PR policy: only obvious bug fixes, doc/typo fixes, or items explicitly requested in issues/discussions. Include clear description, repro steps, and screenshots for UI changes.

## Security & Configuration Tips
- Development copies into your vault; verify `VAULT_DIR` before running `bun dev`.
- Grep features rely on ripgrep; set the command path in plugin settings when testing.
