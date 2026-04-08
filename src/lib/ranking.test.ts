import { describe, expect, it } from "vitest";

import {
  computeChampionshipRanking,
  computeMatchScores,
  DEFAULT_POINTS_BY_POSITION,
} from "@/lib/ranking";

describe("computeMatchScores", () => {
  it("calculates position and knockout points", () => {
    const participants = ["a", "b", "c", "d"];

    const eliminations = [
      {
        id: "1",
        matchId: "m1",
        playerId: "d",
        eliminatedByUserId: "a",
        eliminationOrder: 1,
        createdAt: Date.now(),
      },
      {
        id: "2",
        matchId: "m1",
        playerId: "c",
        eliminatedByUserId: "a",
        eliminationOrder: 2,
        createdAt: Date.now(),
      },
      {
        id: "3",
        matchId: "m1",
        playerId: "b",
        eliminatedByUserId: "a",
        eliminationOrder: 3,
        createdAt: Date.now(),
      },
    ];

    const scores = computeMatchScores({
      participantIds: participants,
      eliminations,
      pointsByPosition: DEFAULT_POINTS_BY_POSITION,
    });

    const winner = scores.find((item) => item.userId === "a");
    const last = scores.find((item) => item.userId === "d");

    expect(winner?.position).toBe(1);
    expect(winner?.pointsKnockout).toBe(6);
    expect(last?.position).toBe(4);
  });
});

describe("computeChampionshipRanking", () => {
  it("aggregates ranking over many matches", () => {
    const round1 = [
      {
        userId: "a",
        pointsPosition: 20,
        pointsKnockout: 2,
        totalPoints: 22,
        position: 1,
        knockouts: 1,
      },
      {
        userId: "b",
        pointsPosition: 18,
        pointsKnockout: 0,
        totalPoints: 18,
        position: 2,
        knockouts: 0,
      },
    ];

    const round2 = [
      {
        userId: "a",
        pointsPosition: 16,
        pointsKnockout: 0,
        totalPoints: 16,
        position: 3,
        knockouts: 0,
      },
      {
        userId: "b",
        pointsPosition: 20,
        pointsKnockout: 4,
        totalPoints: 24,
        position: 1,
        knockouts: 2,
      },
    ];

    const ranking = computeChampionshipRanking([round1, round2]);

    expect(ranking[0].userId).toBe("b");
    expect(ranking[0].totalPoints).toBe(42);
    expect(ranking[1].totalPoints).toBe(38);
  });
});
