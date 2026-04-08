import type { EliminationEvent, MatchScore, RankingRow } from "@/lib/types";

export const DEFAULT_POINTS_BY_POSITION: Record<number, number> = {
  1: 20,
  2: 18,
  3: 16,
  4: 14,
  5: 12,
  6: 10,
  7: 8,
  8: 6,
  9: 5,
  10: 4,
  11: 3,
  12: 2,
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
      };

      table.set(score.userId, {
        userId: score.userId,
        totalPoints: current.totalPoints + score.totalPoints,
        matches: current.matches + 1,
        knockouts: current.knockouts + score.knockouts,
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
