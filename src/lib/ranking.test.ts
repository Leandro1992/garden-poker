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
        pointsPosition: 25,
        pointsKnockout: 2,
        totalPoints: 27,
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
        pointsPosition: 15,
        pointsKnockout: 0,
        totalPoints: 15,
        position: 3,
        knockouts: 0,
      },
      {
        userId: "b",
        pointsPosition: 25,
        pointsKnockout: 4,
        totalPoints: 29,
        position: 1,
        knockouts: 2,
      },
    ];

    const ranking = computeChampionshipRanking([round1, round2]);

    expect(ranking[0].userId).toBe("b");
    expect(ranking[0].totalPoints).toBe(47);
    expect(ranking[1].totalPoints).toBe(42);
  });

  it("assigns zero placement points for positions above top 10 (WO rule)", () => {
    const participants = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"];

    const eliminations = [
      { id: "1", matchId: "m1", playerId: "p11", eliminatedByUserId: null, eliminationOrder: 1, createdAt: Date.now() },
      { id: "2", matchId: "m1", playerId: "p10", eliminatedByUserId: null, eliminationOrder: 2, createdAt: Date.now() },
      { id: "3", matchId: "m1", playerId: "p9", eliminatedByUserId: null, eliminationOrder: 3, createdAt: Date.now() },
      { id: "4", matchId: "m1", playerId: "p8", eliminatedByUserId: null, eliminationOrder: 4, createdAt: Date.now() },
      { id: "5", matchId: "m1", playerId: "p7", eliminatedByUserId: null, eliminationOrder: 5, createdAt: Date.now() },
      { id: "6", matchId: "m1", playerId: "p6", eliminatedByUserId: null, eliminationOrder: 6, createdAt: Date.now() },
      { id: "7", matchId: "m1", playerId: "p5", eliminatedByUserId: null, eliminationOrder: 7, createdAt: Date.now() },
      { id: "8", matchId: "m1", playerId: "p4", eliminatedByUserId: null, eliminationOrder: 8, createdAt: Date.now() },
      { id: "9", matchId: "m1", playerId: "p3", eliminatedByUserId: null, eliminationOrder: 9, createdAt: Date.now() },
      { id: "10", matchId: "m1", playerId: "p2", eliminatedByUserId: null, eliminationOrder: 10, createdAt: Date.now() },
    ];

    const scores = computeMatchScores({
      participantIds: participants,
      eliminations,
      pointsByPosition: DEFAULT_POINTS_BY_POSITION,
    });

    const eleventh = scores.find((item) => item.userId === "p11");
    const tenth = scores.find((item) => item.userId === "p10");

    expect(eleventh?.position).toBe(11);
    expect(eleventh?.pointsPosition).toBe(0);
    expect(eleventh?.totalPoints).toBe(0);
    expect(tenth?.position).toBe(10);
    expect(tenth?.pointsPosition).toBe(1);
  });
});
