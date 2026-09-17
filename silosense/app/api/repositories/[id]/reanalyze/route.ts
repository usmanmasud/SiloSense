import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepositoryForUser } from "@/lib/queries";
import { startAnalysisRun } from "@/lib/analysis";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`analyze:${user.id}`, 10, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(600);
  }

  const { id } = await params;
  const repository = getRepositoryForUser(user.id, id);
  if (!repository) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runId = startAnalysisRun(repository.id);
  return NextResponse.json({ runId }, { status: 201 });
}
