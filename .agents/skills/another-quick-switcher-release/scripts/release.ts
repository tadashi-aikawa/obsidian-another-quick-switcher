#!/usr/bin/env bun
import { readFileSync } from "node:fs";

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const execEnv = { ...Bun.env };
delete execEnv.GITHUB_TOKEN;

const TESTS_WORKFLOW = "tests.yaml";
const RELEASE_WORKFLOW = "release.yaml";

type ExecOptions = {
  allowFailure?: boolean;
};

type CliOptions = {
  branch: string;
  dryRun: boolean;
  skipIssueNotify: boolean;
};

type RepoInfo = {
  owner: string;
  name: string;
};

type ReleaseInfo = {
  tagName: string;
  name: string | null;
  publishedAt: string | null;
  body: string | null;
  url: string;
};

type IssueCandidate = {
  number: number;
  title: string;
  url: string;
  state: string;
  isPullRequest: boolean;
  authorLogin: string | null;
  fetchFailed: boolean;
};

type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_sha: string;
  head_branch: string;
};

function printHelp() {
  console.log(`Another Quick Switcher release helper

Usage:
  bun .agents/skills/another-quick-switcher-release/scripts/release.ts [options]

Options:
  --branch <name>        Target branch (default: master)
  --dry-run              Skip dispatch/pull and run post steps with latest release
  --skip-issue-notify    Skip issue candidate listing and reply draft
  --help                 Show this help
`);
}

function parseArgs(argv: string[]): CliOptions {
  let branch = "master";
  let dryRun = false;
  let skipIssueNotify = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--skip-issue-notify") {
      skipIssueNotify = true;
      continue;
    }
    if (arg === "--branch") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--branch には値が必要です。");
      }
      branch = value;
      i++;
      continue;
    }
    throw new Error(`不明な引数です: ${arg}`);
  }

  return { branch, dryRun, skipIssueNotify };
}

async function exec(command: string[], options: ExecOptions = {}) {
  const result = Bun.spawnSync({
    cmd: command,
    stdout: "pipe",
    stderr: "pipe",
    env: execEnv,
  });
  const stdout = decoder.decode(result.stdout ?? new Uint8Array());
  const stderr = decoder.decode(result.stderr ?? new Uint8Array());
  if (result.exitCode !== 0 && !options.allowFailure) {
    throw new Error(
      `コマンド実行に失敗しました: ${command.join(" ")}\n${stderr || stdout}`,
    );
  }
  return { stdout, stderr, exitCode: result.exitCode } as const;
}

function parseRepo(url: string): RepoInfo {
  if (url.startsWith("git@")) {
    const match = url.match(/git@[^:]+:([^/]+)\/(.+)\.git/);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    const match = url.match(/https?:\/\/[^/]+\/([^/]+)\/(.+)\.git/);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  }
  throw new Error(`GitリモートURLからowner/repoを判別できませんでした: ${url}`);
}

async function ensureToolAvailable(command: string) {
  const result = await exec(["which", command], { allowFailure: true });
  if (result.exitCode !== 0) {
    throw new Error(`必須コマンド '${command}' が見つかりません。`);
  }
}

async function ensureGhAuth() {
  const auth = await exec(["gh", "auth", "status"], { allowFailure: true });
  if (auth.exitCode !== 0) {
    throw new Error(
      "gh の認証状態を確認できません。`gh auth login` を先に実行してください。",
    );
  }
}

async function ensureOnBranch(expectedBranch: string): Promise<void> {
  const currentBranch = (
    await exec(["git", "rev-parse", "--abbrev-ref", "HEAD"])
  ).stdout.trim();
  if (currentBranch !== expectedBranch) {
    throw new Error(
      `現在のブランチは '${currentBranch}' です。'${expectedBranch}' で実行してください。`,
    );
  }
}

async function ensureCleanWorkingTree() {
  const status = await exec(["git", "status", "--porcelain"]);
  if (status.stdout.trim().length > 0) {
    throw new Error(
      "未コミットの変更があります。コミットまたは退避してから実行してください。",
    );
  }
}

async function ensureNoUnpushedCommits(branch: string) {
  await exec(["git", "fetch", "--prune"]);
  const upstreamResult = await exec(
    ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    { allowFailure: true },
  );
  if (upstreamResult.exitCode !== 0) {
    throw new Error(
      `トラッキングブランチが設定されていません。'git push -u origin ${branch}' を先に実行してください。`,
    );
  }
  const upstream = upstreamResult.stdout.trim();
  const aheadInfo = await exec([
    "git",
    "rev-list",
    "--left-right",
    "--count",
    `${upstream}...HEAD`,
  ]);
  const [behindRaw, aheadRaw] = aheadInfo.stdout.trim().split(/\s+/);
  const ahead = Number(aheadRaw ?? "0");
  const behind = Number(behindRaw ?? "0");
  if (Number.isNaN(ahead) || Number.isNaN(behind)) {
    throw new Error(
      `未pushコミット数の取得に失敗しました: ${aheadInfo.stdout}`,
    );
  }
  if (ahead > 0) {
    throw new Error(
      `未pushのコミットが ${ahead} 件あります。push を完了してから再実行してください。`,
    );
  }
  if (behind > 0) {
    console.log(
      `ℹ️  リモートに ${behind} 件の新しいコミットがあります。後で pull で取り込みます。`,
    );
  }
  console.log("✅ 未pushコミットはありません。");
}

async function runPrePush() {
  console.log("🔍 bun run pre:push を実行します...");
  await exec(["bun", "run", "pre:push"]);
  console.log("✅ pre:push が成功しました。");
}

async function ensureCiSuccess(repo: RepoInfo, branch: string) {
  console.log("🔍 Testsワークフローの最新結果を確認します...");
  const { stdout } = await exec([
    "gh",
    "api",
    `repos/${repo.owner}/${repo.name}/actions/workflows/${TESTS_WORKFLOW}/runs`,
    "--method",
    "GET",
    "-F",
    `branch=${branch}`,
    "-F",
    "per_page=5",
  ]);
  const runs = JSON.parse(stdout).workflow_runs as WorkflowRun[] | undefined;
  if (!runs || runs.length === 0) {
    throw new Error("Testsワークフローの実行履歴が見つかりません。");
  }
  const latest = runs.find((run) => run.head_branch === branch) ?? runs[0];
  if (latest.status !== "completed") {
    throw new Error(
      `Testsワークフローが完了していません (status: ${latest.status})。`,
    );
  }
  if (latest.conclusion !== "success") {
    throw new Error(
      `Testsワークフローが成功していません (conclusion: ${latest.conclusion ?? "unknown"})。`,
    );
  }
  console.log("✅ Testsワークフローの最新実行は成功しています。");
}

async function ensureNoRunningRelease(repo: RepoInfo) {
  const { stdout } = await exec([
    "gh",
    "api",
    `repos/${repo.owner}/${repo.name}/actions/workflows/${RELEASE_WORKFLOW}/runs`,
    "--method",
    "GET",
    "-F",
    "per_page=5",
  ]);
  const runs = JSON.parse(stdout).workflow_runs as WorkflowRun[] | undefined;
  if (!runs) {
    return;
  }
  const running = runs.find(
    (run) => run.status === "queued" || run.status === "in_progress",
  );
  if (running) {
    throw new Error(
      `Releaseワークフロー (run_id: ${running.id}) が進行中です。完了後に再実行してください。`,
    );
  }
}

async function triggerReleaseWorkflow(
  repo: RepoInfo,
  branch: string,
): Promise<number> {
  console.log("🚀 Releaseワークフローを実行します...");
  await ensureNoRunningRelease(repo);
  const dispatchTime = new Date();
  await exec([
    "gh",
    "api",
    `repos/${repo.owner}/${repo.name}/actions/workflows/${RELEASE_WORKFLOW}/dispatches`,
    "-X",
    "POST",
    "-F",
    `ref=${branch}`,
  ]);
  const runId = await waitForNewReleaseRun(repo, dispatchTime);
  console.log(`ℹ️  Releaseワークフロー run_id=${runId} を検知しました。`);
  return runId;
}

async function waitForNewReleaseRun(repo: RepoInfo, since: Date) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const { stdout } = await exec([
      "gh",
      "api",
      `repos/${repo.owner}/${repo.name}/actions/workflows/${RELEASE_WORKFLOW}/runs`,
      "--method",
      "GET",
      "-F",
      "per_page=5",
    ]);
    const runs = JSON.parse(stdout).workflow_runs as WorkflowRun[] | undefined;
    if (runs && runs.length > 0) {
      const run = runs.find((item) => {
        const createdAt = new Date(item.created_at).getTime();
        return createdAt >= since.getTime() - 10_000;
      });
      if (run) {
        return run.id;
      }
    }
    await Bun.sleep(5000);
  }
  throw new Error("Releaseワークフローの新規実行を検出できませんでした。");
}

async function waitForRunCompletion(repo: RepoInfo, runId: number) {
  const deadline = Date.now() + 60 * 60 * 1000;
  while (Date.now() < deadline) {
    const { stdout } = await exec([
      "gh",
      "api",
      `repos/${repo.owner}/${repo.name}/actions/runs/${runId}`,
    ]);
    const run: WorkflowRun = JSON.parse(stdout);
    if (run.status === "completed") {
      if (run.conclusion !== "success") {
        throw new Error(
          `Releaseワークフローが失敗しました (conclusion: ${run.conclusion ?? "unknown"})。`,
        );
      }
      console.log("✅ Releaseワークフローが正常終了しました。");
      return;
    }
    console.log(
      `⏳ Releaseワークフロー実行中... status=${run.status}, updated_at=${run.updated_at}`,
    );
    await Bun.sleep(10_000);
  }
  throw new Error("Releaseワークフローの完了待機がタイムアウトしました。");
}

async function fetchLatestRelease(repo: RepoInfo): Promise<ReleaseInfo | null> {
  const { stdout } = await exec([
    "gh",
    "release",
    "list",
    "--limit",
    "1",
    "--json",
    "tagName,publishedAt,name",
  ]);
  const releases = JSON.parse(stdout) as Array<{
    tagName: string;
    publishedAt: string | null;
    name: string | null;
  }>;
  if (!releases || releases.length === 0) {
    return null;
  }
  const latestMeta = releases[0];
  const viewResult = await exec([
    "gh",
    "release",
    "view",
    latestMeta.tagName,
    "--json",
    "body,tagName,name,publishedAt",
  ]);
  const viewJson = JSON.parse(viewResult.stdout) as {
    body: string | null;
    tagName: string;
    name: string | null;
    publishedAt: string | null;
  };
  return {
    tagName: viewJson.tagName,
    name: viewJson.name,
    publishedAt: viewJson.publishedAt,
    body: viewJson.body,
    url: `https://github.com/${repo.owner}/${repo.name}/releases/tag/${encodeURIComponent(viewJson.tagName)}`,
  };
}

async function waitForNewRelease(
  repo: RepoInfo,
  previous: ReleaseInfo | null,
  startedAt: Date,
): Promise<ReleaseInfo> {
  const previousTag = previous?.tagName ?? null;
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const latest = await fetchLatestRelease(repo);
    if (latest) {
      if (previousTag && latest.tagName !== previousTag) {
        console.log(`✅ 新しいリリース ${latest.tagName} を確認しました。`);
        return latest;
      }
      if (!previousTag) {
        const publishedAt = latest.publishedAt
          ? new Date(latest.publishedAt)
          : null;
        if (
          !publishedAt ||
          publishedAt.getTime() >= startedAt.getTime() - 60_000
        ) {
          console.log(`✅ 初回リリース ${latest.tagName} を確認しました。`);
          return latest;
        }
      }
    }
    console.log("⏳ GitHubリリースページを確認中...");
    await Bun.sleep(10_000);
  }
  throw new Error(
    "新しいリリースが作成されませんでした。GitHub上でステータスを確認してください。",
  );
}

function extractIssueNumbers(body: string | null): number[] {
  if (!body) {
    return [];
  }
  const matches = body.match(/#(\d+)/g);
  if (!matches) {
    return [];
  }
  const numbers = matches
    .map((m) => Number(m.slice(1)))
    .filter((n) => !Number.isNaN(n));
  return Array.from(new Set(numbers));
}

async function fetchIssueCandidate(
  repo: RepoInfo,
  issueNumber: number,
): Promise<IssueCandidate> {
  const fallbackUrl = `https://github.com/${repo.owner}/${repo.name}/issues/${issueNumber}`;
  const result = await exec(
    ["gh", "api", `repos/${repo.owner}/${repo.name}/issues/${issueNumber}`],
    { allowFailure: true },
  );
  if (result.exitCode !== 0) {
    return {
      number: issueNumber,
      title: "(取得失敗)",
      url: fallbackUrl,
      state: "unknown",
      isPullRequest: false,
      authorLogin: null,
      fetchFailed: true,
    };
  }
  const issue = JSON.parse(result.stdout) as {
    title?: string;
    html_url?: string;
    state?: string;
    pull_request?: unknown;
    user?: {
      login?: string;
    };
  };
  return {
    number: issueNumber,
    title: issue.title ?? "(タイトルなし)",
    url: issue.html_url ?? fallbackUrl,
    state: issue.state ?? "unknown",
    isPullRequest: Boolean(issue.pull_request),
    authorLogin: issue.user?.login ?? null,
    fetchFailed: false,
  };
}

async function printIssueCandidates(
  repo: RepoInfo,
  release: ReleaseInfo,
): Promise<IssueCandidate[]> {
  const issueNumbers = extractIssueNumbers(release.body);
  if (issueNumbers.length === 0) {
    console.log("ℹ️  リリースノートに関連Issue番号は見つかりませんでした。");
    return [];
  }
  console.log(`🗒  関連Issue候補(${issueNumbers.join(", ")})を表示します。`);
  const candidates: IssueCandidate[] = [];
  for (const issueNumber of issueNumbers) {
    const candidate = await fetchIssueCandidate(repo, issueNumber);
    candidates.push(candidate);
    const kind = candidate.isPullRequest ? "Pull Request" : "Issue";
    const status = candidate.fetchFailed
      ? "取得失敗"
      : `${kind}/${candidate.state}`;
    const author = candidate.authorLogin ? ` @${candidate.authorLogin}` : "";
    console.log(
      `- #${candidate.number} [${status}]${author} ${candidate.title} ${candidate.url}`,
    );
    if (candidate.fetchFailed) {
      console.log(
        "  ↳ API取得に失敗しました。必要に応じて手動で確認してください。",
      );
    }
  }
  return candidates;
}

function extractBullets(body: string | null): string[] {
  if (!body) {
    return [];
  }
  const lines = body.split(/\r?\n/);
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
      let content = trimmed.replace(/^[-*]\s+/, "");
      content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      content = content.replace(/\s*\(#\d+\)/g, "");
      content = content.replace(/\s*\([a-f0-9]{7,}\)$/i, "");
      content = content.trim();
      if (content.length > 0) {
        bullets.push(`・${content}`);
      }
    }
    if (bullets.length >= 5) {
      break;
    }
  }
  return bullets;
}

function generateBlueskyPost(productName: string, release: ReleaseInfo) {
  const bullets = extractBullets(release.body);
  const bulletText =
    bullets.length > 0
      ? bullets.join("\n")
      : "・詳細はリリースノートをご覧ください";
  return `📦 ${productName} ${release.tagName} 🚀\n\n${bulletText}\n\n${release.url}`;
}

function generateIssueReplyLine(
  release: ReleaseInfo,
  candidate: IssueCandidate,
) {
  const mention = candidate.authorLogin ? `@${candidate.authorLogin} ` : "";
  return `${mention}Released in ${release.tagName} 🚀`;
}

function generateIssueReplyDraft(
  release: ReleaseInfo,
  candidates: IssueCandidate[],
): string | null {
  const targets = candidates.filter((candidate) => !candidate.isPullRequest);
  if (targets.length === 0) {
    return null;
  }
  return targets
    .map((candidate) => {
      const reply = generateIssueReplyLine(release, candidate);
      return `#${candidate.number}\n${reply}`;
    })
    .join("\n\n");
}

async function gitPull(branch: string, dryRun: boolean) {
  if (dryRun) {
    console.log("ℹ️  dry-run のため git pull をスキップします。");
    return;
  }
  console.log("🔄 git pull --ff-only を実行します...");
  await exec(["git", "pull", "--ff-only", "origin", branch]);
  console.log("✅ git pull 完了");
}

async function copyToClipboard(text: string, label: string): Promise<boolean> {
  try {
    const result = Bun.spawnSync(["cb", "copy"], {
      stdin: encoder.encode(text),
      stdout: "ignore",
      stderr: "pipe",
      env: execEnv,
    });
    if (result.exitCode !== 0) {
      const stderr = decoder.decode(result.stderr).trim();
      const detail = stderr ? `: ${stderr}` : "";
      console.log(`⚠️  cb copy が失敗しました (exitCode=${result.exitCode})${detail}`);
      return false;
    }
    console.log(`✅ ${label}をクリップボードにコピーしました。`);
    return true;
  } catch (error) {
    console.log(
      `⚠️  クリップボードコピー中にエラーが発生しました: ${(error as Error).message}`,
    );
    return false;
  }
}

async function main() {
  const options = parseArgs(Bun.argv.slice(2));

  console.log("=== Another Quick Switcher リリース自動化 ===");
  console.log(
    `mode=${options.dryRun ? "dry-run" : "normal"}, branch=${options.branch}, skipIssueNotify=${options.skipIssueNotify}`,
  );

  await ensureToolAvailable("git");
  await ensureToolAvailable("gh");
  await ensureToolAvailable("bun");
  await ensureToolAvailable("cb");
  await ensureGhAuth();

  const repoUrl = (
    await exec(["git", "config", "--get", "remote.origin.url"])
  ).stdout.trim();
  const repo = parseRepo(repoUrl);

  await ensureOnBranch(options.branch);
  await ensureCleanWorkingTree();
  await ensureNoUnpushedCommits(options.branch);
  await runPrePush();
  await ensureCiSuccess(repo, options.branch);

  let releaseInfo: ReleaseInfo | null = null;
  if (options.dryRun) {
    await ensureNoRunningRelease(repo);
    console.log(
      `ℹ️  dry-run のため Release workflow (${RELEASE_WORKFLOW}) は dispatch しません。`,
    );
    releaseInfo = await fetchLatestRelease(repo);
    if (!releaseInfo) {
      console.log(
        "ℹ️  既存のGitHubリリースがないため、Issue候補表示と投稿文生成をスキップします。",
      );
      await gitPull(options.branch, options.dryRun);
      console.log("✅ dry-run 完了。");
      return;
    }
    console.log(
      `ℹ️  dry-run では既存の最新リリース ${releaseInfo.tagName} を使って後段処理を実行します。`,
    );
  } else {
    const previousRelease = await fetchLatestRelease(repo);
    const releaseStart = new Date();
    const runId = await triggerReleaseWorkflow(repo, options.branch);
    await waitForRunCompletion(repo, runId);
    releaseInfo = await waitForNewRelease(repo, previousRelease, releaseStart);
  }

  let issueCandidates: IssueCandidate[] = [];
  if (options.skipIssueNotify) {
    console.log(
      "ℹ️  --skip-issue-notify により Issue候補一覧表示と返信文生成をスキップします。",
    );
  } else {
    issueCandidates = await printIssueCandidates(repo, releaseInfo);
  }

  const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
    name?: string;
  };
  const productName = manifest.name ?? repo.name;
  const blueskyPost = generateBlueskyPost(productName, releaseInfo);
  console.log("\n=== Bluesky投稿案 ===");
  console.log(blueskyPost);
  console.log("=== 投稿案ここまで ===\n");
  await copyToClipboard(blueskyPost, "Bluesky投稿案");

  if (!options.skipIssueNotify) {
    const issueReplyDraft = generateIssueReplyDraft(releaseInfo, issueCandidates);
    if (!issueReplyDraft) {
      console.log("ℹ️  返信対象Issueがないため、返信文の生成をスキップします。");
    } else {
      console.log("\n=== Issue返信文テンプレート ===");
      console.log(issueReplyDraft);
      console.log("=== 返信文ここまで ===\n");
      await copyToClipboard(issueReplyDraft, "Issue返信文テンプレート");
    }
  }

  await gitPull(options.branch, options.dryRun);
  if (options.dryRun) {
    console.log("✅ dry-run 完了。後段処理まで実行しました。");
  } else {
    console.log("🎉 リリースフローが完了しました。");
  }
}

main().catch((error) => {
  console.error(
    `❌ リリース処理中にエラーが発生しました: ${(error as Error).message}`,
  );
  process.exit(1);
});
