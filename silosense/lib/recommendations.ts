import type { ComponentFeatures } from "./features";
import type { RiskLevel } from "./scoring";

export type Recommendation = {
  action: string;
  priority: "high" | "medium" | "low";
};

export function generateRecommendations(
  features: ComponentFeatures,
  level: RiskLevel,
  complexityNorm: number
): Recommendation[] {
  if (level === "low") return [];

  const priority: Recommendation["priority"] =
    level === "high" ? "high" : level === "elevated" ? "medium" : "low";
  const [top, second] = features.topContributors;
  const recs: Recommendation[] = [];

  if (top && features.totalContributors <= 1) {
    recs.push({
      action: `${top.name} is the only recorded contributor to this file. Pair a second developer on the next change, or write a short documentation walkthrough before relying on it further.`,
      priority,
    });
  } else if (top && second) {
    recs.push({
      action: `Pair ${top.name} (${Math.round(top.share * 100)}% of recent weighted changes) with ${second.name} on the next change to spread ownership of this file.`,
      priority,
    });
  }

  if (
    top &&
    features.daysSinceLastCommit !== null &&
    features.daysSinceLastCommit > 180
  ) {
    recs.push({
      action: `The last change was made ${Math.round(features.daysSinceLastCommit)} days ago by ${top.name}. Confirm the team still has working knowledge of this file before its next change.`,
      priority,
    });
  }

  if (complexityNorm > 0.6 && features.dominantShare > 0.6) {
    recs.push({
      action: `This file is both relatively complex and concentrated in one contributor. Add or update inline documentation and assign a secondary owner.`,
      priority,
    });
  }

  return recs;
}
