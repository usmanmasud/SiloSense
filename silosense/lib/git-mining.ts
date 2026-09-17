import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

export const MAX_COMMITS = Number(process.env.SILOSENSE_MAX_COMMITS ?? 2000);
const CLONE_TIMEOUT_MS = Number(
  process.env.SILOSENSE_CLONE_TIMEOUT_MS ?? 4 * 60 * 1000
);
const COMMAND_TIMEOUT_MS = Number(
  process.env.SILOSENSE_COMMAND_TIMEOUT_MS ?? 3 * 60 * 1000
);

export class GitMiningError extends Error {}

function runGit(
  args: string[],
  { cwd, timeoutMs }: { cwd?: string; timeoutMs: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new GitMiningError(
          `git ${args[0]} timed out after ${Math.round(timeoutMs / 1000)}s`
        )
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new GitMiningError(`failed to run git: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new GitMiningError(
            `git ${args[0]} exited with code ${code}: ${stderr.trim().slice(0, 500)}`
          )
        );
      }
    });
  });
}

export type CommitFileChange = {
  path: string;
  additions: number;
  deletions: number;
};

export type RawCommit = {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string; // ISO 8601
  files: CommitFileChange[];
};

export type MinedRepo = {
  defaultBranch: string;
  commits: RawCommit[]; // oldest first
  fileSizes: Map<string, number>; // path -> byte size at HEAD
  truncated: boolean;
};

const RECORD_SEP = "\x01";
const FIELD_SEP = "\x09";

function parseLog(raw: string): RawCommit[] {
  const commits: RawCommit[] = [];
  const chunks = raw.split(RECORD_SEP).filter((c) => c.trim().length > 0);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const header = lines[0];
    const [hash, authorName, authorEmail, date] = header.split(FIELD_SEP);
    if (!hash) continue;

    const files: CommitFileChange[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const [addRaw, delRaw, ...pathParts] = parts;
      const filePath = pathParts.join("\t");
      files.push({
        path: filePath,
        additions: addRaw === "-" ? 0 : Number(addRaw) || 0,
        deletions: delRaw === "-" ? 0 : Number(delRaw) || 0,
      });
    }

    commits.push({ hash, authorName, authorEmail, date, files });
  }

  return commits.reverse(); // oldest first
}

async function detectDefaultBranch(gitDir: string): Promise<string> {
  try {
    const out = await runGit(
      ["--git-dir", gitDir, "symbolic-ref", "--short", "HEAD"],
      { timeoutMs: 15_000 }
    );
    return out.trim();
  } catch {
    return "HEAD";
  }
}

async function readFileSizesAtHead(
  gitDir: string
): Promise<Map<string, number>> {
  const out = await runGit(["--git-dir", gitDir, "ls-tree", "-r", "-l", "HEAD"], {
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  const sizes = new Map<string, number>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    // <mode> <type> <sha> <size>\t<path>
    const [meta, filePath] = line.split("\t");
    if (!filePath) continue;
    const metaParts = meta.trim().split(/\s+/);
    const size = Number(metaParts[3]);
    if (!Number.isNaN(size)) sizes.set(filePath, size);
  }
  return sizes;
}

export async function mineRepository(cloneUrl: string): Promise<MinedRepo> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "silosense-"));
  const gitDir = path.join(tmpDir, "repo.git");

  try {
    await runGit(
      ["clone", "--bare", "--single-branch", "--quiet", cloneUrl, gitDir],
      { timeoutMs: CLONE_TIMEOUT_MS }
    );

    const defaultBranch = await detectDefaultBranch(gitDir);

    const logRaw = await runGit(
      [
        "--git-dir",
        gitDir,
        "log",
        `--max-count=${MAX_COMMITS}`,
        "--no-renames",
        "--date=iso-strict",
        `--pretty=format:${RECORD_SEP}%H${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%ad`,
        "--numstat",
        defaultBranch,
      ],
      { timeoutMs: COMMAND_TIMEOUT_MS }
    );

    const commits = parseLog(logRaw);
    const fileSizes = await readFileSizesAtHead(gitDir);

    const totalCountRaw = await runGit(
      ["--git-dir", gitDir, "rev-list", "--count", defaultBranch],
      { timeoutMs: 30_000 }
    ).catch(() => "");
    const totalCount = Number(totalCountRaw.trim());
    const truncated = Number.isFinite(totalCount) && totalCount > MAX_COMMITS;

    return { defaultBranch, commits, fileSizes, truncated };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
