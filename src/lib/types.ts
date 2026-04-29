export type UserRole = "admin" | "player";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: number;
};

export type Championship = {
  id: string;
  name: string;
  year: number;
  status: "open" | "closed";
  pointsByPosition: Record<number, number>;
  createdAt: number;
};

export type Match = {
  id: string;
  championshipId: string;
  playedAt: string;
  participantIds: string[];
  status: "open" | "finished";
  createdBy: string;
  createdAt: number;
};

export type EliminationEvent = {
  id: string;
  matchId: string;
  playerId: string;
  eliminatedByUserId: string | null;
  eliminationOrder: number;
  createdAt: number;
};

export type MatchScore = {
  userId: string;
  pointsPosition: number;
  pointsKnockout: number;
  totalPoints: number;
  position: number;
  knockouts: number;
};

export type RankingRow = {
  userId: string;
  totalPoints: number;
  matches: number;
  knockouts: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  trend: "up" | "down" | "same" | "new";
  trendDelta: number;
};
