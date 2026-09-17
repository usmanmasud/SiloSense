import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, newId } from "@/lib/db";
import { parseGitHubUrl } from "@/lib/repo-url";
import { createRepositorySchema } from "@/lib/validation";
import { startAnalysisRun } from "@/lib/analysis";
import { listRepositoriesForUser } from "@/lib/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ repositories: listRepositoriesForUser(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createRepositorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const parsedUrl = parseGitHubUrl(parsed.data.url);
  if (!parsedUrl) {
    return NextResponse.json(
      { error: "Enter a valid public GitHub repository URL, e.g. https://github.com/owner/repo" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare(`SELECT id FROM repositories WHERE user_id = ? AND url = ?`)
    .get(user.id, parsedUrl.cloneUrl) as { id: string } | undefined;

  let repositoryId: string;
  if (existing) {
    repositoryId = existing.id;
  } else {
    repositoryId = newId("repo");
    db.prepare(
      `INSERT INTO repositories (id, user_id, owner, name, url) VALUES (?, ?, ?, ?, ?)`
    ).run(repositoryId, user.id, parsedUrl.owner, parsedUrl.name, parsedUrl.cloneUrl);
  }

  const runId = startAnalysisRun(repositoryId);

  return NextResponse.json({ repositoryId, runId }, { status: 201 });
}
