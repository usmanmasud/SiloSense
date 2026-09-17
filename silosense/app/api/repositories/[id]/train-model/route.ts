import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepositoryForUser } from "@/lib/queries";
import { trainAndPersistModel } from "@/lib/ml-pipeline";
import { getPlanLimits } from "@/lib/plans";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getPlanLimits(user.plan).mlTrainingEnabled) {
    return NextResponse.json(
      { error: "Risk-prediction model training is a Pro feature. Upgrade your plan to use it." },
      { status: 402 }
    );
  }

  const { id } = await params;
  const repository = await getRepositoryForUser(user.id, id);
  if (!repository) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await trainAndPersistModel(repository.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  return NextResponse.json({ modelId: result.modelId }, { status: 201 });
}
