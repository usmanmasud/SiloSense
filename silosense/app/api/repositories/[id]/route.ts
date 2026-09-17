import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  getRepositoryForUser,
  getLatestRun,
  getLatestScoresForRepository,
  getAlertsForRepository,
  getLatestMlModel,
} from "@/lib/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const repository = await getRepositoryForUser(user.id, id);
  if (!repository) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latestRun = await getLatestRun(repository.id);
  const [scores, alerts, mlModel] = await Promise.all([
    latestRun?.status === "completed" ? getLatestScoresForRepository(repository.id) : [],
    getAlertsForRepository(repository.id, 10),
    getLatestMlModel(repository.id),
  ]);

  return NextResponse.json({
    repository,
    latestRun,
    scores,
    alerts,
    mlModel: mlModel
      ? { id: mlModel.id, trainedAt: mlModel.trained_at, metrics: JSON.parse(mlModel.metrics_json), nWindows: mlModel.n_windows }
      : null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const repository = await getRepositoryForUser(user.id, id);
  if (!repository) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query(`DELETE FROM repositories WHERE id = $1`, [repository.id]);
  return NextResponse.json({ ok: true });
}
