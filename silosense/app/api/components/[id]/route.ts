import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  getComponentById,
  getScoreHistoryForComponent,
  getRecommendationsForScore,
  getLatestMlModel,
  getMlPredictionForComponent,
} from "@/lib/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const component = await getComponentById(id);
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const repository = await queryOne<{ id: string; owner: string; name: string; user_id: string }>(
    `SELECT id, owner, name, user_id FROM repositories WHERE id = $1`,
    [component.repository_id]
  );
  if (!repository || repository.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await getScoreHistoryForComponent(component.id);
  const latest = history[history.length - 1] ?? null;
  const recommendations = latest ? await getRecommendationsForScore(latest.id) : [];

  const mlModel = await getLatestMlModel(repository.id);
  const prediction = mlModel ? await getMlPredictionForComponent(component.id, mlModel.id) : null;

  return NextResponse.json({
    component,
    repository: { id: repository.id, owner: repository.owner, name: repository.name },
    history: history.map((h) => ({
      ...h,
      explanation: JSON.parse(h.explanation_json),
    })),
    latest: latest ? { ...latest, explanation: JSON.parse(latest.explanation_json) } : null,
    recommendations,
    prediction,
  });
}
