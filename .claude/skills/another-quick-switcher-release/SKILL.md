---
name: another-quick-switcher-release
description: Another Quick Switcher のリリース運用を実施するときに使う。事前検証 (pre:push と CI 状態確認)、Release workflow の dispatch、完了待機、新規 release 検出、リリースノート由来の Issue 一覧と返信文の作成、最後の同期までを一連で安全に進める用途で利用する。
---

# Another Quick Switcher Release

## Overview

この Skill は `obsidian-another-quick-switcher` のリリース作業を再現可能な手順に固定する。
確定的な検証・実行は同梱スクリプトが担当し、非確定的な文章生成は Codex (LLM) が担当する。

## Runbook

1. 実行前提を満たす。
   - `bun` が利用可能
   - `gh` が利用可能
   - `gh auth status` が成功
2. Codex CLI から実行する場合は、`gh` を使うコマンドを最初から escalated で実行する。
   - 対象: `gh auth status` / `bun .agents/skills/another-quick-switcher-release/scripts/release.ts ...`
   - 理由: sandbox と host で `gh` の認証コンテキストが異なる場合があるため
3. リポジトリルートで次を実行する。
   - `bun .agents/skills/another-quick-switcher-release/scripts/release.ts`
4. スクリプトの `=== RELEASE_RESULT_JSON_BEGIN ===` から `=== RELEASE_RESULT_JSON_END ===` までの JSON を読み取り、`assets/templates` のテンプレートを使って次を標準出力する。
   - Bluesky 投稿案
   - Issue 返信テンプレート
5. 投稿案・返信文はクリップボードにコピーせず、標準出力へ表示する。
6. 動作確認のみ行うときは dry-run を使う。
   - `bun .agents/skills/another-quick-switcher-release/scripts/release.ts --dry-run`

## Script Options

- `--branch <name>`: 対象ブランチを指定する。既定は `master`。
- `--dry-run`: dispatch / git pull を実行しない。
- `--skip-issue-notify`: Issue 候補一覧表示をスキップする。
- `--help`: 使い方を表示する。

## Output Contract

- スクリプトは実行ログに加え、最後に `RELEASE_RESULT_JSON` ブロックを標準出力する。
- LLM はこの JSON の `release` / `issueCandidates` を入力として文章を作る。
- `issueCandidates` には Pull Request も含まれるため、Issue 返信テンプレートでは `isPullRequest=false` のみを対象にする。

## Assets

- `assets/templates/bluesky-post.txt`
- `assets/templates/issue-reply.txt`

## Issue Reply Template Format

Issue 返信は `assets/templates/issue-reply.txt` を使って生成する。
形式変更はテンプレートファイル側で行う。

- `{issueUrls}` は対象 Issue URL を1行ずつ列挙する。
- `{mentions}` は対象 Issue の `authorLogin` を重複除去したメンション行に置換する。
- `authorLogin` が1人なら1人分、複数なら空白区切りで1行にまとめる。
- `{releaseVersion}` は `release.tagName` を使う。
- 対象 Issue が0件の場合はテンプレートを使わず「対象Issueはありません」を明示する。

## Bluesky Post Format (Strict)

Bluesky 投稿案は `assets/templates/bluesky-post.txt` を使って生成する。
形式変更はテンプレートファイル側で行う。
- `{productName}` は `result.productName` を使う。
- `{release.tagName}` は公開されたタグ名を使う。
- `{changesSummaryJa}` は日本語の自然な要約1〜2文にする。
- 単なるコミット文の羅列は避け、利用者視点の要約にする。
- `{release.url}` は GitHub Release URL をそのまま使う。

## Notes

- 実運用フローと判定基準は `references/release-workflow.md` を参照する。
- 失敗時は、エラーメッセージに対応する troubleshooting 手順を参照する。
- 毎回の権限確認を減らすには、次の `prefix_rule` を永続承認する。
  - `["bun", ".agents/skills/another-quick-switcher-release/scripts/release.ts"]`
  - `["gh", "auth", "status"]`
  - `["gh", "api", "repos/tadashi-aikawa/obsidian-another-quick-switcher"]`
- Skill は手順を定義するためのものであり、権限付与そのものは Codex CLI 側の承認フローで管理される。
