# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin called "Another Quick Switcher" that provides advanced file and content navigation capabilities. It offers multiple search modes including file search, grep, header navigation, backlinks, and custom search commands.

## Development Commands

- `bun i` - Install dependencies
- `bun dev` - Development build with watch mode
- `bun run build` - Production build with TypeScript check
- `bun run test` - Run Jest tests
- `bun run ci` - Full CI pipeline (lint, build, test)
- `biome check src *.mts` - Lint TypeScript files
- `tsc -noEmit -skipLibCheck` - Type checking only

## Architecture

### Core Components

**Main Plugin Structure:**
- `src/main.ts` - Plugin entry point, lifecycle management, command registration
- `src/settings.ts` - Comprehensive settings system with 200+ configuration options
- `src/commands.ts` - Command factory functions for different search modes
- `src/app-helper.ts` - Abstraction layer over Obsidian APIs

**Modal System:**
- `src/ui/AnotherQuickSwitcherModal.ts` - Main configurable search modal
- `src/ui/GrepModal.ts` - Text content search using ripgrep
- `src/ui/BacklinkModal.ts` - Backlink navigation
- `src/ui/LinkModal.ts` - Outgoing link navigation  
- `src/ui/HeaderModal.ts` - In-file header navigation
- `src/ui/InFileModal.ts` - In-file text search with quoted phrase support
- `src/ui/FolderModal.ts` & `MoveModal.ts` - File system operations

**Core Systems:**
- `src/matcher.ts` - Text matching and scoring algorithms
- `src/sorters.ts` - 20+ configurable sort priorities
- `src/transformer.ts` - Data transformation for search results
- `src/utils/strings.ts` - String processing utilities including `smartWhitespaceSplit` for quoted phrase parsing

### Key Patterns

1. **Command-Based Architecture** - All functionality exposed through registered Obsidian commands
2. **Settings-Driven Configuration** - Highly customizable behavior through comprehensive settings
3. **Modal Specialization** - Different modal classes for specific search types
4. **External Tool Integration** - Uses ripgrep for performance-critical search operations

### External Dependencies

- **ripgrep** - Required for grep functionality (both content and filename search), set path in "Ripgrep command" setting

## Development Notes

- Uses Bun as package manager and build tool
- TypeScript with strict mode enabled
- Biome for linting and formatting (spaces, not tabs)
- Jest for testing with esbuild transformer
- Obsidian plugin API version 1.7.2+
- **IMPORTANT**: Always run `biome check src` after making code changes to avoid CI failures

### Architecture Guidelines

- **sorters.ts is NOT a generic sort utility**: This file defines only the sort priorities available in the main Search Commands' "Sort priorities" setting. Do not add generic sorting functions or priorities that are specific to individual modals.
- **Modal-specific sorting**: Each modal (like MoveModal) should implement its own sorting logic if it needs custom sorting behavior that differs from the main search priorities.
- **Settings patterns**: Use the `mirror()` utility pattern for dropdown settings, following the same pattern as SearchTarget (e.g., `mirror([...optionsList])` for readonly arrays).

### Implementation Guidelines

- **Single choice over multiple choices**: When designing settings, prefer single-choice dropdowns over multi-choice text areas. This eliminates the need to handle invalid values and simplifies algorithms.
- **Default value handling**: For file path settings, use empty string as default and implement fallback logic in code rather than hardcoding paths in settings. This allows for automatic path selection while still enabling customization.
- **Feature scope validation**: Remove non-functional features early rather than keeping them as placeholders. Half-implemented features cause user confusion.

### Modal Development Guidelines

- Use `safeClose()` for modal transitions to ensure proper state restoration
- New hotkeys in settings should have empty default arrays `[]` (no default shortcuts)
- For GrepModal modifications, initialize after `onOpen()` when `basePath` is available
- Follow existing patterns in `setHotkeys()` for registering new hotkey handlers
- Use `smartWhitespaceSplit()` instead of `split(" ")` for query parsing to support quoted phrases
- Quoted phrase functionality: `"hello world"` searches for exact match, `hello world` searches for both words
- Escape functionality: `\"` allows searching for literal quote characters (e.g., `search \"` finds `search "`)

## Settings Architecture

The plugin has a complex settings system supporting:
- Custom search commands with configurable targets and sorting
- Per-modal hotkey customization
- Path filtering and exclusions
- Search behavior customization (fuzzy matching, prefix matching, etc.)

Settings are deeply merged on load and heavily validated in the UI.

## Testing

Tests are located alongside source files with `.test.ts` suffix. Focus on:
- `transformer.test.ts` - Data transformation logic
- `collection-helper.test.ts` - Utility functions
- `math.test.ts` - Scoring calculations
- `path.test.ts` - Path manipulation
- `strings.test.ts` - String processing

Run tests before any significant changes to ensure compatibility.

## Commit Guidelines

- Use Conventional Commits format: `feat(scope):`, `fix(scope):`, etc.
- Scope examples: `main`, `grep`, `header`, `backlink`, `settings`
- Keep first line concise and user-focused (appears in release notes)
- Add bullet points for implementation details only when necessary
- No default hotkey assignments for new features (user configurable only)
- Use `chore:` for formatting-only changes (not `fix:`) to avoid user confusion
- Format commit messages concisely - avoid unnecessary details for maintenance tasks

## Memory

- Always ask for clarification when there are ambiguous instructions or potential risks to the project
- lintやformatのチェックをするときは `bun pre:push` を実行してください。まとめて確認できるので便利です。そして、bunのformatによって意図した改行が失われてしまう場合は、bunのformatを無視するコメントを入れてください。
- **MoveModalのfuzzy検索とハイライト実装パターン**: 他のModalと一貫性を保つため、`smartMicroFuzzy`、`createHighlightedText`、`another-quick-switcher__hit_word`CSSクラスを使用。`SuggestionItem`に`score`、`ranges`、マッチタイプ固有のranges（例: `directoryRanges`）を追加。
- **「Recently used」設定時の並び順**: マッチタイプ優先度よりも設定された並び順（Recently used、Alphabetical等）を優先する。特に「Recently used」設定では、`isRecentlyUsed`プロパティによる明示的な区別が重要。
- **設定値の範囲外アイテムへの影響**: 「Max recently used folders」などの設定値により、一部のアイテムが意図した挙動にならない場合がある。設定値の確認が必要。
- **GrepModalのAND検索実装**: スペース区切りクエリはAND検索として動作。`smartWhitespaceSplit`でパース、複数ripgrep実行して`mergeAndFilterResults`で結合。ファイル名検索は`rgFiles`関数でripgrepの`--files`オプション使用。fdは削除済み。
- **文字位置変換の重要性**: ripgrepはUTF-8バイト位置を返すが、JavaScriptはUTF-16文字位置。`byteToCharPosition`で変換が必要。絵文字のサロゲートペア対応も重要。
- **テストファイルの判断基準**: Mock化が困難で実用価値が低いテストファイル（例: execFileを使う関数のテスト）は削除する。実装と異なるロジックをテストするのは意味がない。
- **外部依存削除時の注意点**: 設定インターフェース、デフォルト値、UI、チェック処理、説明文、READMEまで一貫して更新。部分的な削除は起動エラーを引き起こす。
- **ripgrepのexecFileバッファ制限**: 大量の検索結果（`'deno .*'`など）でJSONパースエラーが発生する場合、`maxBuffer`の不足が原因。100MBから1GBに増加で解決。同時にexecFileのエラーハンドリングとJSON.parseのtry-catch処理を追加してより堅牢に。
- **正規表現エラーハンドリングの実装パターン**: 不正な正規表現（`'deno ('`など）でripgrepエラーが発生する問題の解決方法。1) `isValidRegex`関数で事前チェック、2) ripgrepエラーをキャッチして構造化、3) UIでエラーメッセージ表示、4) リアルタイムバリデーション。エラーメッセージはカウント表示エリアに表示し、結果数メッセージで上書きされないよう条件分岐が重要。