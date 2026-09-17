export type ComponentEvent = {
  date: string; // ISO 8601
  authorKey: string; // lower-cased email, used to group commits by person
  authorName: string;
  additions: number;
  deletions: number;
};

export type ContributorShare = {
  name: string;
  email: string;
  commits: number;
  churn: number;
  weight: number;
  share: number;
};

export type ComponentFeatures = {
  totalCommits: number;
  totalContributors: number;
  entropy: number; // normalized diversity, 0 = fully concentrated, 1 = evenly spread
  dominantShare: number; // 0..1, churn-weighted (falls back to commit count if no churn data)
  decayedShare: number; // 0..1, recency-weighted concentration (half-life decay)
  churnTotal: number;
  lastCommitDate: string | null;
  daysSinceLastCommit: number | null;
  topContributors: ContributorShare[];
};

const DECAY_HALF_LIFE_DAYS = 120;

/**
 * Computes concentration/recency features for one component from its commit
 * events, as of a given cutoff date. `events` must already be filtered to
 * events with date <= asOf by the caller (the analysis pipeline slices per
 * cutoff for efficiency when building ML training windows).
 */
export function computeComponentFeatures(
  events: ComponentEvent[],
  asOf: Date
): ComponentFeatures {
  if (events.length === 0) {
    return {
      totalCommits: 0,
      totalContributors: 0,
      entropy: 0,
      dominantShare: 0,
      decayedShare: 0,
      churnTotal: 0,
      lastCommitDate: null,
      daysSinceLastCommit: null,
      topContributors: [],
    };
  }

  const byAuthor = new Map<
    string,
    { name: string; email: string; commits: number; churn: number }
  >();

  let churnTotal = 0;
  let lastCommitDate = events[0].date;

  for (const ev of events) {
    const churn = ev.additions + ev.deletions;
    churnTotal += churn;
    if (ev.date > lastCommitDate) lastCommitDate = ev.date;

    const existing = byAuthor.get(ev.authorKey);
    if (existing) {
      existing.commits += 1;
      existing.churn += churn;
    } else {
      byAuthor.set(ev.authorKey, {
        name: ev.authorName,
        email: ev.authorKey,
        commits: 1,
        churn,
      });
    }
  }

  const useChurnWeight = churnTotal > 0;
  const withWeight = Array.from(byAuthor.values()).map((a) => ({
    ...a,
    weight: useChurnWeight ? a.churn : a.commits,
  }));
  const totalWeight = withWeight.reduce((sum, a) => sum + a.weight, 0);

  const topContributors: ContributorShare[] = withWeight
    .map((a) => ({
      name: a.name,
      email: a.email,
      commits: a.commits,
      churn: a.churn,
      weight: a.weight,
      share: totalWeight > 0 ? a.weight / totalWeight : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const dominantShare = topContributors[0]?.share ?? 0;

  const totalContributors = byAuthor.size;
  let entropy = 0;
  if (totalContributors > 1 && totalWeight > 0) {
    let h = 0;
    for (const a of topContributors) {
      if (a.share <= 0) continue;
      h -= a.share * Math.log(a.share);
    }
    entropy = h / Math.log(totalContributors);
  }

  // Recency-weighted concentration: decay each event's weight by age, then
  // re-derive per-author totals and take the largest share. This can surface
  // a *different* leading contributor than the all-time dominant one when
  // someone recently took over a file.
  const decayedByAuthor = new Map<string, number>();
  let decayedTotal = 0;
  for (const ev of events) {
    const ageDays = Math.max(
      0,
      (asOf.getTime() - new Date(ev.date).getTime()) / 86_400_000
    );
    const base = useChurnWeight ? ev.additions + ev.deletions : 1;
    const decayed = base * Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
    decayedByAuthor.set(
      ev.authorKey,
      (decayedByAuthor.get(ev.authorKey) ?? 0) + decayed
    );
    decayedTotal += decayed;
  }
  const maxDecayed = Math.max(0, ...decayedByAuthor.values());
  const decayedShare = decayedTotal > 0 ? maxDecayed / decayedTotal : 0;

  const daysSinceLastCommit =
    (asOf.getTime() - new Date(lastCommitDate).getTime()) / 86_400_000;

  return {
    totalCommits: events.length,
    totalContributors,
    entropy,
    dominantShare,
    decayedShare,
    churnTotal,
    lastCommitDate,
    daysSinceLastCommit,
    topContributors: topContributors.slice(0, 5),
  };
}
