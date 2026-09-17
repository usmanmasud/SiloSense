import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepositoryForUser } from "@/lib/queries";
import { startAnalysisRun } from "@/lib/analysis";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { getPlanLimits } from "@/lib/plans";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limits = getPlanLimits(user.plan);
  if (!rateLimit(`analyze:${user.id}`, limits.maxAnalysesPerHour, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(600);
  }

  const { id } = await params;
  const repository = await getRepositoryForUser(user.id, id);
  if (!repository) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runId = await startAnalysisRun(repository.id);
  return NextResponse.json({ runId }, { status: 201 });
}
