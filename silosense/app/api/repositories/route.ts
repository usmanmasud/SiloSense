import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne, newId } from "@/lib/db";
import { parseGitHubUrl } from "@/lib/repo-url";
import { createRepositorySchema } from "@/lib/validation";
import { startAnalysisRun } from "@/lib/analysis";
import { listRepositoriesForUser } from "@/lib/queries";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { getPlanLimits } from "@/lib/plans";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ repositories: await listRepositoriesForUser(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limits = getPlanLimits(user.plan);

  if (!rateLimit(`analyze:${user.id}`, limits.maxAnalysesPerHour, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(600);
  }

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

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM repositories WHERE user_id = $1 AND url = $2`,
    [user.id, parsedUrl.cloneUrl]
  );

  let repositoryId: string;
  if (existing) {
    repositoryId = existing.id;
  } else {
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM repositories WHERE user_id = $1`,
      [user.id]
    );
    if (Number(countRow?.count ?? 0) >= limits.maxRepositories) {
      return NextResponse.json(
        {
          error:
            `You've reached the ${limits.label} plan's limit of ${limits.maxRepositories} repositories. ` +
            (limits.label === "Free"
              ? "Remove one, or upgrade to Pro for more."
              : "Remove one before adding another."),
        },
        { status: 400 }
      );
    }

    repositoryId = newId("repo");
    await query(
      `INSERT INTO repositories (id, user_id, owner, name, url) VALUES ($1, $2, $3, $4, $5)`,
      [repositoryId, user.id, parsedUrl.owner, parsedUrl.name, parsedUrl.cloneUrl]
    );
  }

  const runId = await startAnalysisRun(repositoryId);

  return NextResponse.json({ repositoryId, runId }, { status: 201 });
}
