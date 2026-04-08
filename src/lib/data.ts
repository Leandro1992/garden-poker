import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { computeChampionshipRanking, computeMatchScores } from "@/lib/ranking";
import type {
  AppUser,
  Championship,
  EliminationEvent,
  Match,
  MatchScore,
  RankingRow,
  UserRole,
} from "@/lib/types";

const usersCol = collection(db, "users");
const championshipsCol = collection(db, "championships");
const matchesCol = collection(db, "matches");
const eliminationsCol = collection(db, "eliminations");

function normalizePointsByPosition(input: Record<number, number> | undefined): Record<number, number> {
  if (!input) {
    return {
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
  }
  return input;
}

export async function upsertUserProfile(params: {
  uid: string;
  email: string;
  name: string;
  role?: UserRole;
}): Promise<AppUser> {
  const userRef = doc(usersCol, params.uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      const role = params.role ?? "player";
      tx.set(userRef, {
        email: params.email,
        name: params.name,
        role,
        active: role === "admin",
        createdAt: serverTimestamp(),
      });
      return;
    }

    tx.update(userRef, {
      email: params.email,
      name: params.name,
    });
  });

  const finalSnap = await getDoc(userRef);
  const data = finalSnap.data();

  return {
    id: finalSnap.id,
    email: data?.email ?? params.email,
    name: data?.name ?? params.name,
    role: (data?.role as UserRole) ?? "player",
    active: Boolean(data?.active),
    createdAt: Date.now(),
  };
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(usersCol, uid));
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  return {
    id: snap.id,
    email: data.email,
    name: data.name,
    role: data.role,
    active: Boolean(data.active),
    createdAt: Date.now(),
  };
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(usersCol, orderBy("name", "asc")));
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      email: data.email,
      name: data.name,
      role: data.role,
      active: Boolean(data.active),
      createdAt: Date.now(),
    };
  });
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  await updateDoc(doc(usersCol, userId), { role });
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  await updateDoc(doc(usersCol, userId), { active });
}

export async function createChampionship(params: {
  name: string;
  year: number;
  pointsByPosition?: Record<number, number>;
}): Promise<string> {
  const docRef = await addDoc(championshipsCol, {
    name: params.name,
    year: params.year,
    status: "open",
    pointsByPosition: normalizePointsByPosition(params.pointsByPosition),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function listChampionships(): Promise<Championship[]> {
  const snap = await getDocs(query(championshipsCol, orderBy("year", "desc")));
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      name: data.name,
      year: data.year,
      status: data.status,
      pointsByPosition: data.pointsByPosition ?? normalizePointsByPosition(undefined),
      createdAt: Date.now(),
    };
  });
}

export async function createMatch(params: {
  championshipId: string;
  playedAt: string;
  participantIds: string[];
  createdBy: string;
}): Promise<string> {
  const docRef = await addDoc(matchesCol, {
    championshipId: params.championshipId,
    playedAt: params.playedAt,
    participantIds: params.participantIds,
    createdBy: params.createdBy,
    status: "open",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function listMatches(championshipId: string): Promise<Match[]> {
  const snap = await getDocs(query(matchesCol, where("championshipId", "==", championshipId)));

  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        championshipId: data.championshipId,
        playedAt: data.playedAt,
        participantIds: data.participantIds ?? [],
        status: data.status,
        createdBy: data.createdBy,
        createdAt: Date.now(),
      };
    })
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

export async function listEliminations(matchId: string): Promise<EliminationEvent[]> {
  const snap = await getDocs(query(eliminationsCol, where("matchId", "==", matchId)));

  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        matchId: data.matchId,
        playerId: data.playerId,
        eliminatedByUserId: data.eliminatedByUserId ?? null,
        eliminationOrder: data.eliminationOrder,
        createdAt: Date.now(),
      };
    })
    .sort((a, b) => a.eliminationOrder - b.eliminationOrder);
}

export async function registerElimination(params: {
  matchId: string;
  playerId: string;
  eliminatedByUserId: string | null;
}): Promise<void> {
  const already = await getDocs(
    query(eliminationsCol, where("matchId", "==", params.matchId), where("playerId", "==", params.playerId)),
  );

  if (!already.empty) {
    throw new Error("Jogador ja foi eliminado nesta partida.");
  }

  const currentEliminations = await listEliminations(params.matchId);
  const nextOrder = currentEliminations.length + 1;

  await addDoc(eliminationsCol, {
    matchId: params.matchId,
    playerId: params.playerId,
    eliminatedByUserId: params.eliminatedByUserId,
    eliminationOrder: nextOrder,
    createdAt: serverTimestamp(),
  });
}

export async function finishMatch(matchId: string): Promise<void> {
  await updateDoc(doc(matchesCol, matchId), { status: "finished" });
}

export async function calculateMatchScores(matchId: string): Promise<MatchScore[]> {
  const matchSnap = await getDoc(doc(matchesCol, matchId));
  if (!matchSnap.exists()) {
    return [];
  }

  const matchData = matchSnap.data();
  const championshipSnap = await getDoc(doc(championshipsCol, matchData.championshipId));
  const eliminations = await listEliminations(matchId);

  const pointsByPosition = championshipSnap.exists()
    ? (championshipSnap.data().pointsByPosition as Record<number, number>)
    : normalizePointsByPosition(undefined);

  return computeMatchScores({
    participantIds: matchData.participantIds ?? [],
    eliminations,
    pointsByPosition: pointsByPosition ?? normalizePointsByPosition(undefined),
  });
}

export async function calculateChampionshipRanking(championshipId: string): Promise<RankingRow[]> {
  const matches = await listMatches(championshipId);
  const results = await Promise.all(matches.map((match) => calculateMatchScores(match.id)));
  return computeChampionshipRanking(results);
}

export async function seedInitialRanking(params: {
  championshipId: string;
  rows: Array<{ userId: string; totalPoints: number }>;
}): Promise<void> {
  const rankingSeedCol = collection(db, "rankingSeeds");
  await Promise.all(
    params.rows.map((row) =>
      setDoc(doc(rankingSeedCol, `${params.championshipId}_${row.userId}`), {
        championshipId: params.championshipId,
        userId: row.userId,
        totalPoints: row.totalPoints,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

export async function readRankingSeed(championshipId: string): Promise<Record<string, number>> {
  const rankingSeedCol = collection(db, "rankingSeeds");
  const snap = await getDocs(query(rankingSeedCol, where("championshipId", "==", championshipId)));
  const map: Record<string, number> = {};
  snap.docs.forEach((item) => {
    const data = item.data();
    map[data.userId] = Number(data.totalPoints ?? 0);
  });
  return map;
}
