import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
  const component = getComponentById(id);
  if (!component) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const repository = db
    .prepare(`SELECT id, owner, name, user_id FROM repositories WHERE id = ?`)
    .get(component.repository_id) as
    | { id: string; owner: string; name: string; user_id: string }
    | undefined;
  if (!repository || repository.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = getScoreHistoryForComponent(component.id);
  const latest = history[history.length - 1] ?? null;
  const recommendations = latest ? getRecommendationsForScore(latest.id) : [];

  const mlModel = getLatestMlModel(repository.id);
  const prediction = mlModel ? getMlPredictionForComponent(component.id, mlModel.id) : null;

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
