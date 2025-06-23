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
4. **External Tool Integration** - Uses ripgrep and fd for performance-critical operations

### External Dependencies

- **ripgrep** - Required for grep functionality, set path in "Ripgrep command" setting
- **fd** - Optional for file name search in grep mode, enable "Include file name in search"

## Development Notes

- Uses Bun as package manager and build tool
- TypeScript with strict mode enabled
- Biome for linting and formatting (spaces, not tabs)
- Jest for testing with esbuild transformer
- Obsidian plugin API version 1.7.2+

### Modal Development Guidelines

- Use `safeClose()` for modal transitions to ensure proper state restoration
- New hotkeys in settings should have empty default arrays `[]` (no default shortcuts)
- For GrepModal modifications, initialize after `onOpen()` when `basePath` is available
- Follow existing patterns in `setHotkeys()` for registering new hotkey handlers
- Use `smartWhitespaceSplit()` instead of `split(" ")` for query parsing to support quoted phrases
- Quoted phrase functionality: `"hello world"` searches for exact match, `hello world` searches for both words

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