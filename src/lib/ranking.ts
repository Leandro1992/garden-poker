import type { EliminationEvent, MatchScore, RankingRow } from "@/lib/types";

export const DEFAULT_POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

export function computeMatchScores(params: {
  participantIds: string[];
  eliminations: EliminationEvent[];
  pointsByPosition: Record<number, number>;
}): MatchScore[] {
  const { participantIds, eliminations, pointsByPosition } = params;

  if (participantIds.length === 0) {
    return [];
  }

  const byOrder = [...eliminations].sort(
    (a, b) => a.eliminationOrder - b.eliminationOrder,
  );

  const eliminatedIds = new Set(byOrder.map((item) => item.playerId));
  const championId = participantIds.find((id) => !eliminatedIds.has(id)) ?? null;

  const positionByUser = new Map<string, number>();
  byOrder.forEach((item, index) => {
    const position = participantIds.length - index;
    positionByUser.set(item.playerId, position);
  });

  if (championId) {
    positionByUser.set(championId, 1);
  }

  const knockoutCount = new Map<string, number>();
  byOrder.forEach((item) => {
    if (!item.eliminatedByUserId) {
      return;
    }
    knockoutCount.set(
      item.eliminatedByUserId,
      (knockoutCount.get(item.eliminatedByUserId) ?? 0) + 1,
    );
  });

  return participantIds
    .map((userId) => {
      const position = positionByUser.get(userId) ?? participantIds.length;
      const pointsPosition = pointsByPosition[position] ?? 0;
      const knockouts = knockoutCount.get(userId) ?? 0;
      const pointsKnockout = knockouts * 2;

      return {
        userId,
        position,
        pointsPosition,
        pointsKnockout,
        knockouts,
        totalPoints: pointsPosition + pointsKnockout,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.position - b.position;
    });
}

export function computeChampionshipRanking(matchScores: MatchScore[][]): RankingRow[] {
  const table = new Map<string, RankingRow>();

  matchScores.forEach((scores) => {
    scores.forEach((score) => {
      const current = table.get(score.userId) ?? {
        userId: score.userId,
        totalPoints: 0,
        matches: 0,
        knockouts: 0,
        firstPlaces: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        trend: "same" as const,
        trendDelta: 0,
      };

      table.set(score.userId, {
        userId: score.userId,
        totalPoints: current.totalPoints + score.totalPoints,
        matches: current.matches + 1,
        knockouts: current.knockouts + score.knockouts,
        firstPlaces: current.firstPlaces + (score.position === 1 ? 1 : 0),
        secondPlaces: current.secondPlaces + (score.position === 2 ? 1 : 0),
        thirdPlaces: current.thirdPlaces + (score.position === 3 ? 1 : 0),
        trend: current.trend,
        trendDelta: current.trendDelta,
      });
    });
  });

  return [...table.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return b.knockouts - a.knockouts;
  });
}
