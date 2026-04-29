import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { computeChampionshipRanking, computeMatchScores, DEFAULT_POINTS_BY_POSITION } from "@/lib/ranking";
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
  const legacyPointsByPosition: Record<number, number> = {
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

  if (!input) {
    return DEFAULT_POINTS_BY_POSITION;
  }

  const isLegacy = Object.entries(legacyPointsByPosition).every(
    ([position, points]) => Number(input[Number(position)] ?? 0) === points,
  );

  if (isLegacy) {
    return DEFAULT_POINTS_BY_POSITION;
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

export type UserAccessUpdateResult = {
  action: "activated" | "deactivated" | "deleted";
};

export async function updateUserAccessByHistory(userId: string, active: boolean): Promise<UserAccessUpdateResult> {
  if (active) {
    await updateDoc(doc(usersCol, userId), { active: true });
    return { action: "activated" };
  }

  const userRef = doc(usersCol, userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    throw new Error("Usuario nao encontrado.");
  }

  const userData = userSnap.data();
  if (userData.role === "admin") {
    await updateDoc(userRef, { active: false });
    return { action: "deactivated" };
  }

  const [matchesAsParticipant, eliminationsAsPlayer, eliminationsAsEliminator, matchesAsCreator] = await Promise.all([
    getDocs(query(matchesCol, where("participantIds", "array-contains", userId))),
    getDocs(query(eliminationsCol, where("playerId", "==", userId))),
    getDocs(query(eliminationsCol, where("eliminatedByUserId", "==", userId))),
    getDocs(query(matchesCol, where("createdBy", "==", userId))),
  ]);

  const hasHistory =
    !matchesAsParticipant.empty ||
    !eliminationsAsPlayer.empty ||
    !eliminationsAsEliminator.empty ||
    !matchesAsCreator.empty;

  if (hasHistory) {
    await updateDoc(userRef, { active: false });
    return { action: "deactivated" };
  }

  const rankingSeedCol = collection(db, "rankingSeeds");
  const rankingSeedSnap = await getDocs(query(rankingSeedCol, where("userId", "==", userId)));

  const batch = writeBatch(db);
  rankingSeedSnap.docs.forEach((item) => {
    batch.delete(item.ref);
  });
  batch.delete(userRef);
  await batch.commit();

  return { action: "deleted" };
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
      pointsByPosition: normalizePointsByPosition(data.pointsByPosition as Record<number, number> | undefined),
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

export async function getMatchById(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(matchesCol, matchId));
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data();
  return {
    id: snap.id,
    championshipId: data.championshipId,
    playedAt: data.playedAt,
    participantIds: data.participantIds ?? [],
    status: data.status,
    createdBy: data.createdBy,
    createdAt: Date.now(),
  };
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
  const matchSnap = await getDoc(doc(matchesCol, params.matchId));
  if (!matchSnap.exists()) {
    throw new Error("Partida nao encontrada.");
  }

  const matchData = matchSnap.data();
  const participantIds = Array.isArray(matchData.participantIds) ? (matchData.participantIds as string[]) : [];

  if (participantIds.length < 2) {
    throw new Error("Partida invalida para registro de eliminacao.");
  }

  if (matchData.status !== "open") {
    throw new Error("A partida ja foi finalizada.");
  }

  if (!participantIds.includes(params.playerId)) {
    throw new Error("Jogador eliminado nao participa desta partida.");
  }

  if (params.eliminatedByUserId && !participantIds.includes(params.eliminatedByUserId)) {
    throw new Error("Jogador eliminador nao participa desta partida.");
  }

  if (params.eliminatedByUserId && params.eliminatedByUserId === params.playerId) {
    throw new Error("Eliminador nao pode ser o proprio jogador eliminado.");
  }

  const already = await getDocs(
    query(eliminationsCol, where("matchId", "==", params.matchId), where("playerId", "==", params.playerId)),
  );

  if (!already.empty) {
    throw new Error("Jogador ja foi eliminado nesta partida.");
  }

  const currentEliminations = await listEliminations(params.matchId);

  if (currentEliminations.length >= participantIds.length - 2) {
    throw new Error("Nao ha KO quando restam apenas dois jogadores.");
  }

  const eliminatedIds = new Set(currentEliminations.map((item) => item.playerId));
  if (params.eliminatedByUserId && eliminatedIds.has(params.eliminatedByUserId)) {
    throw new Error("O eliminador informado ja foi eliminado nesta partida.");
  }

  const nextOrder = currentEliminations.length + 1;

  await addDoc(eliminationsCol, {
    matchId: params.matchId,
    playerId: params.playerId,
    eliminatedByUserId: params.eliminatedByUserId,
    eliminationOrder: nextOrder,
    createdAt: serverTimestamp(),
  });
}

export async function undoLastElimination(matchId: string): Promise<void> {
  const matchSnap = await getDoc(doc(matchesCol, matchId));
  if (!matchSnap.exists()) {
    throw new Error("Partida nao encontrada.");
  }

  const matchData = matchSnap.data();
  if (matchData.status !== "open") {
    throw new Error("Nao e possivel desfazer KO em partida finalizada.");
  }

  const eliminations = await listEliminations(matchId);
  if (eliminations.length === 0) {
    throw new Error("Nao ha KO para desfazer nesta partida.");
  }

  const lastElimination = eliminations[eliminations.length - 1];
  await deleteDoc(doc(eliminationsCol, lastElimination.id));
}

export async function finishMatch(matchId: string): Promise<void> {
  await updateDoc(doc(matchesCol, matchId), { status: "finished" });
}

export async function deleteMatch(matchId: string): Promise<void> {
  const eliminationsSnap = await getDocs(query(eliminationsCol, where("matchId", "==", matchId)));

  if (eliminationsSnap.empty) {
    await deleteDoc(doc(matchesCol, matchId));
    return;
  }

  const batch = writeBatch(db);
  eliminationsSnap.docs.forEach((item) => {
    batch.delete(item.ref);
  });
  batch.delete(doc(matchesCol, matchId));
  await batch.commit();
}

export async function calculateMatchScores(matchId: string): Promise<MatchScore[]> {
  const matchSnap = await getDoc(doc(matchesCol, matchId));
  if (!matchSnap.exists()) {
    return [];
  }

  const matchData = matchSnap.data();
  if (matchData.status !== "finished") {
    return [];
  }

  const championshipSnap = await getDoc(doc(championshipsCol, matchData.championshipId));
  const eliminations = await listEliminations(matchId);

  const pointsByPosition = championshipSnap.exists()
    ? normalizePointsByPosition(championshipSnap.data().pointsByPosition as Record<number, number> | undefined)
    : normalizePointsByPosition(undefined);

  return computeMatchScores({
    participantIds: matchData.participantIds ?? [],
    eliminations,
    pointsByPosition: pointsByPosition ?? normalizePointsByPosition(undefined),
  });
}

export async function calculateChampionshipRanking(championshipId: string): Promise<RankingRow[]> {
  const matches = (await listMatches(championshipId)).filter((match) => match.status === "finished");
  const results = await Promise.all(matches.map((match) => calculateMatchScores(match.id)));
  return computeChampionshipRanking(results);
}

export async function calculateChampionshipRankingComparison(championshipId: string): Promise<{
  current: RankingRow[];
  previous: RankingRow[];
}> {
  const finishedMatches = (await listMatches(championshipId)).filter((match) => match.status === "finished");
  const results = await Promise.all(finishedMatches.map((match) => calculateMatchScores(match.id)));

  return {
    current: computeChampionshipRanking(results),
    previous: computeChampionshipRanking(results.slice(1)),
  };
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

export type ImportParticipantRow = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type ImportParticipantsResult = {
  created: number;
  failed: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

function mapIdentityError(errorCode: string | undefined): string {
  switch (errorCode) {
    case "EMAIL_EXISTS":
      return "Email ja cadastrado no Firebase Auth.";
    case "INVALID_EMAIL":
      return "Email invalido.";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
    case "WEAK_PASSWORD":
      return "Senha fraca (minimo de 6 caracteres).";
    default:
      return "Falha ao criar conta no Firebase Auth.";
  }
}

async function createAuthUser(params: { email: string; password: string; displayName: string }): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY nao configurada.");
  }

  const signUpResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      returnSecureToken: true,
    }),
  });

  const signUpPayload = (await signUpResponse.json()) as {
    localId?: string;
    idToken?: string;
    error?: { message?: string };
  };

  if (!signUpResponse.ok || !signUpPayload.localId || !signUpPayload.idToken) {
    throw new Error(mapIdentityError(signUpPayload.error?.message));
  }

  const updateResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: signUpPayload.idToken,
      displayName: params.displayName,
      returnSecureToken: false,
    }),
  });

  if (!updateResponse.ok) {
    throw new Error("Conta criada, mas falhou ao definir nome de exibicao.");
  }

  return signUpPayload.localId;
}

export async function importParticipants(rows: ImportParticipantRow[]): Promise<ImportParticipantsResult> {
  const existingUsers = await listUsers();
  const existingEmails = new Set(existingUsers.map((item) => item.email.trim().toLowerCase()));

  const result: ImportParticipantsResult = {
    created: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const email = row.email.trim().toLowerCase();

    if (existingEmails.has(email)) {
      result.failed += 1;
      result.errors.push({
        row: rowNumber,
        email,
        reason: "Email ja existe no cadastro de participantes.",
      });
      continue;
    }

    try {
      const uid = await createAuthUser({
        email,
        password: row.password,
        displayName: row.name,
      });

      await setDoc(doc(usersCol, uid), {
        email,
        name: row.name,
        role: row.role,
        active: row.role === "admin",
        createdAt: serverTimestamp(),
      });

      existingEmails.add(email);
      result.created += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Falha desconhecida ao importar participante.";
      result.failed += 1;
      result.errors.push({ row: rowNumber, email, reason });
    }
  }

  return result;
}
