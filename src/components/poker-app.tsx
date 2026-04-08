"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  calculateChampionshipRanking,
  calculateMatchScores,
  createChampionship,
  createMatch,
  finishMatch,
  getUserProfile,
  listChampionships,
  listEliminations,
  listMatches,
  listUsers,
  readRankingSeed,
  registerElimination,
  seedInitialRanking,
  setUserActive,
  setUserRole,
  upsertUserProfile,
} from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { MainMenu } from "@/components/main-menu";
import type { AppUser, Championship, EliminationEvent, Match, MatchScore, RankingRow } from "@/lib/types";

type Flash = { type: "error" | "success"; message: string } | null;
type PokerView = "dashboard" | "partidas" | "ranking" | "participantes";

const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export function PokerApp({ view = "dashboard" }: { view?: PokerView }) {
  const lastUserIdRef = useRef<string | null>(null);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [seedMap, setSeedMap] = useState<Record<string, number>>({});
  const [selectedChampionshipId, setSelectedChampionshipId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchScores, setMatchScores] = useState<MatchScore[]>([]);
  const [eliminations, setEliminations] = useState<EliminationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);

  const [authForm, setAuthForm] = useState({
    mode: "login" as "login" | "register",
    email: "",
    password: "",
    name: "",
  });

  const [championshipForm, setChampionshipForm] = useState({
    name: "Campeonato",
    year: new Date().getFullYear(),
  });
  const [matchFormDate, setMatchFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [eliminationForm, setEliminationForm] = useState({ playerId: "", eliminatedByUserId: "" });
  const [seedText, setSeedText] = useState("{}");

  const selectedChampionship = useMemo(
    () => championships.find((item) => item.id === selectedChampionshipId) ?? null,
    [championships, selectedChampionshipId],
  );

  const selectedMatch = useMemo(
    () => matches.find((item) => item.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  const activePlayers = useMemo(() => users.filter((item) => item.active), [users]);
  const usuarioPendente = Boolean(profile && profile.role === "player" && !profile.active);
  const isAdmin = profile?.role === "admin";

  const showMatchOps = view === "partidas";
  const showRanking = view === "dashboard" || view === "ranking";
  const showParticipants = view === "participantes";
  const showSelectors = view === "partidas" || view === "ranking" || (view === "participantes" && isAdmin);

  const selectedMatchRemaining = useMemo(() => {
    if (!selectedMatch) {
      return [] as AppUser[];
    }
    const eliminated = new Set(eliminations.map((item) => item.playerId));
    return users.filter((item) => selectedMatch.participantIds.includes(item.id) && !eliminated.has(item.id));
  }, [eliminations, selectedMatch, users]);

  const showError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    setFlash({ type: "error", message });
  }, []);

  const clearClientSessionArtifacts = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) {
          continue;
        }
        if (
          key.startsWith("firebase:") ||
          key.includes("firebase") ||
          key.includes("firestore") ||
          key.startsWith("poker-app")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // no-op
    }

    try {
      sessionStorage.clear();
    } catch {
      // no-op
    }

    try {
      if (typeof caches !== "undefined") {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch {
      // no-op
    }

    try {
      if (typeof indexedDB !== "undefined") {
        const dbListFn = (indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> }).databases;
        if (dbListFn) {
          const dbs = await dbListFn.call(indexedDB);
          const targets = dbs
            .map((db) => db.name)
            .filter((name): name is string => Boolean(name))
            .filter((name) => name.includes("firebase") || name.includes("firestore"));

          await Promise.all(
            targets.map(
              (name) =>
                new Promise<void>((resolve) => {
                  const req = indexedDB.deleteDatabase(name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                }),
            ),
          );
        }
      }
    } catch {
      // no-op
    }
  }, []);

  const resetSessionState = useCallback(() => {
    setUsers([]);
    setChampionships([]);
    setMatches([]);
    setRanking([]);
    setSeedMap({});
    setSelectedChampionshipId("");
    setSelectedMatchId("");
    setMatchScores([]);
    setEliminations([]);
    setSelectedParticipantIds([]);
    setEliminationForm({ playerId: "", eliminatedByUserId: "" });
    setFlash(null);
  }, []);

  const refreshCoreData = useCallback(
    async (uid: string) => {
      const [profileSnap, usersSnap, championshipsSnap] = await Promise.all([
        getUserProfile(uid),
        listUsers(),
        listChampionships(),
      ]);

      if (profileSnap) {
        setProfile(profileSnap);
      }
      setUsers(usersSnap);
      setChampionships(championshipsSnap);

      if (!selectedChampionshipId && championshipsSnap.length > 0) {
        setSelectedChampionshipId(championshipsSnap[0].id);
      }
    },
    [selectedChampionshipId],
  );

  const refreshChampionshipData = useCallback(
    async (championshipId: string) => {
      const [matchesSnap, rankingSnap, seedSnap] = await Promise.all([
        listMatches(championshipId),
        calculateChampionshipRanking(championshipId),
        readRankingSeed(championshipId),
      ]);

      setMatches(matchesSnap);
      setSeedMap(seedSnap);

      const merged = rankingSnap.map((item) => ({
        ...item,
        totalPoints: item.totalPoints + (seedSnap[item.userId] ?? 0),
      }));

      Object.entries(seedSnap).forEach(([userId, points]) => {
        if (!merged.some((row) => row.userId === userId)) {
          merged.push({ userId, totalPoints: points, matches: 0, knockouts: 0 });
        }
      });

      merged.sort((a, b) => b.totalPoints - a.totalPoints);
      setRanking(merged);

      if (!selectedMatchId && matchesSnap.length > 0) {
        setSelectedMatchId(matchesSnap[0].id);
      }
    },
    [selectedMatchId],
  );

  const refreshMatchData = useCallback(async (matchId: string) => {
    const [eliminationsSnap, scores] = await Promise.all([listEliminations(matchId), calculateMatchScores(matchId)]);
    setEliminations(eliminationsSnap);
    setMatchScores(scores);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (current) => {
      const previousUid = lastUserIdRef.current;

      if (!current || !current.email) {
        lastUserIdRef.current = null;
        setAuthUser(null);
        setProfile(null);
        resetSessionState();
        setLoading(false);
        return;
      }

      if (previousUid !== current.uid) {
        resetSessionState();
        setProfile(null);
      }

      setAuthUser(current);
      setLoading(true);

      try {
        const role = adminEmails.includes(current.email.toLowerCase()) ? "admin" : "player";
        const userProfile = await upsertUserProfile({
          uid: current.uid,
          email: current.email,
          name: current.displayName ?? current.email.split("@")[0],
          role,
        });

        // Evita aplicar perfil atrasado caso o usuario tenha mudado durante a requisicao.
        if (auth.currentUser?.uid !== current.uid) {
          return;
        }

        setProfile(userProfile);
        lastUserIdRef.current = current.uid;
      } catch (error) {
        setProfile(null);
        setAuthUser(null);
        lastUserIdRef.current = null;
        showError(error);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [resetSessionState, showError]);

  useEffect(() => {
    if (!profile || usuarioPendente) {
      return;
    }
    void refreshCoreData(profile.id);
  }, [profile, refreshCoreData, usuarioPendente]);

  useEffect(() => {
    if (!selectedChampionshipId || usuarioPendente) {
      return;
    }
    void refreshChampionshipData(selectedChampionshipId);
  }, [selectedChampionshipId, refreshChampionshipData, usuarioPendente]);

  useEffect(() => {
    if (!selectedMatchId || usuarioPendente) {
      return;
    }
    void refreshMatchData(selectedMatchId);
  }, [selectedMatchId, refreshMatchData, usuarioPendente]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlash(null);

    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      if (authForm.mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        if (authForm.name.trim()) {
          await updateProfile(credential.user, { displayName: authForm.name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (error) {
      showError(error);
    }
  }

  async function handleGoogleAuth() {
    try {
      setFlash(null);
      if (auth.currentUser) {
        await signOut(auth);
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
      showError(error);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      await clearClientSessionArtifacts();
      resetSessionState();
      setProfile(null);
      setAuthUser(null);
      lastUserIdRef.current = null;

      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }

  async function handleCreateChampionship(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || profile.role !== "admin") {
      return;
    }

    try {
      const id = await createChampionship({
        name: championshipForm.name.trim(),
        year: Number(championshipForm.year),
      });
      await refreshCoreData(profile.id);
      setSelectedChampionshipId(id);
      setFlash({ type: "success", message: "Campeonato criado com sucesso." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleCreateMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || profile.role !== "admin" || !selectedChampionshipId) {
      return;
    }

    if (selectedParticipantIds.length < 2) {
      setFlash({ type: "error", message: "Selecione pelo menos dois participantes." });
      return;
    }

    try {
      const matchId = await createMatch({
        championshipId: selectedChampionshipId,
        playedAt: matchFormDate,
        participantIds: selectedParticipantIds,
        createdBy: profile.id,
      });
      await refreshChampionshipData(selectedChampionshipId);
      setSelectedMatchId(matchId);
      setFlash({ type: "success", message: "Partida aberta." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleRegisterElimination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMatchId || !eliminationForm.playerId) {
      return;
    }

    try {
      await registerElimination({
        matchId: selectedMatchId,
        playerId: eliminationForm.playerId,
        eliminatedByUserId: eliminationForm.eliminatedByUserId || null,
      });
      await refreshMatchData(selectedMatchId);
      if (selectedChampionshipId) {
        await refreshChampionshipData(selectedChampionshipId);
      }
      setEliminationForm({ playerId: "", eliminatedByUserId: "" });
      setFlash({ type: "success", message: "Eliminacao registrada." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleFinishMatch() {
    if (!selectedMatchId || !selectedChampionshipId) {
      return;
    }

    try {
      await finishMatch(selectedMatchId);
      await refreshChampionshipData(selectedChampionshipId);
      await refreshMatchData(selectedMatchId);
      setFlash({ type: "success", message: "Partida finalizada." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleRoleChange(userId: string, role: "admin" | "player") {
    if (!profile || profile.role !== "admin") {
      return;
    }

    try {
      await setUserRole(userId, role);
      await refreshCoreData(profile.id);
      setFlash({ type: "success", message: "Perfil atualizado." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleActiveToggle(userId: string, active: boolean) {
    if (!profile || profile.role !== "admin") {
      return;
    }

    try {
      await setUserActive(userId, active);
      await refreshCoreData(profile.id);
      setFlash({ type: "success", message: active ? "Participante aprovado." : "Participante marcado como pendente." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleSeedImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChampionshipId || !profile || profile.role !== "admin") {
      return;
    }

    try {
      const parsed = JSON.parse(seedText) as Record<string, number>;
      const rows = Object.entries(parsed).map(([userId, totalPoints]) => ({
        userId,
        totalPoints: Number(totalPoints),
      }));
      await seedInitialRanking({ championshipId: selectedChampionshipId, rows });
      await refreshChampionshipData(selectedChampionshipId);
      setFlash({ type: "success", message: "Pontuacao inicial importada." });
    } catch (error) {
      showError(error);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-lg">
          <p className="text-slate-700">Carregando sistema...</p>
        </div>
      </main>
    );
  }

  if (!authUser || !profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-300 bg-white/95 p-6 shadow-2xl backdrop-blur">
          <div className="mb-5 flex items-center justify-center">
            <Image src="/logo.PNG" alt="Garden Poker" width={144} height={144} className="h-28 w-28 object-contain" priority />
          </div>
          <h1 className="text-center text-2xl font-semibold text-slate-900">Garden Poker</h1>
          <p className="mb-5 mt-1 text-center text-sm text-slate-600">
            Registre partidas, nocaute e ranking anual em um so lugar.
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Senha
              <input
                required
                type="password"
                minLength={6}
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
              />
            </label>
            {authForm.mode === "register" ? (
              <label className="block text-sm font-medium text-slate-700">
                Nome de exibicao
                <input
                  required
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                />
              </label>
            ) : null}

            <button className="w-full rounded-xl bg-[#17346b] px-3 py-2.5 font-semibold text-white transition hover:bg-[#10254f]" type="submit">
              {authForm.mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGoogleAuth}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-800 transition hover:bg-slate-50"
          >
            Entrar com Google
          </button>

          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-[#e9ddbd] px-3 py-2.5 font-medium text-[#17346b] transition hover:bg-[#ddcfa7]"
            onClick={() =>
              setAuthForm((prev) => ({
                ...prev,
                mode: prev.mode === "login" ? "register" : "login",
              }))
            }
          >
            {authForm.mode === "login"
              ? "Ainda nao tem conta? Cadastre-se"
              : "Ja possui conta? Fazer login"}
          </button>

          {flash ? (
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                flash.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {flash.message}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  if (usuarioPendente) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <section className="w-full max-w-xl rounded-3xl border border-[#d9cba6] bg-white p-8 shadow-xl">
          <div className="mb-5 flex items-center justify-center">
            <Image src="/logo.PNG" alt="Garden Poker" width={96} height={96} className="h-24 w-24 object-contain" />
          </div>
          <h2 className="text-center text-2xl font-semibold text-[#17346b]">Cadastro em analise</h2>
          <p className="mt-3 text-center text-slate-600">
            Ola, {profile.name}. Seu cadastro foi recebido e esta aguardando aprovacao de um administrador.
          </p>
          <div className="mt-6 flex items-center justify-center">
            <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800">
              Status: Pendente
            </span>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Assim que sua conta for aprovada, voce tera acesso completo ao sistema.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6">
      <AppHeader
        subtitle={`${profile.name} · ${profile.role === "admin" ? "Administrador" : "Jogador"}`}
        onLogout={handleLogout}
      />

      <MainMenu isAdmin={isAdmin} />

      {flash ? (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            flash.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {flash.message}
        </p>
      ) : null}

      {showSelectors ? (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Campeonato
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
              value={selectedChampionshipId}
              onChange={(event) => {
                setSelectedChampionshipId(event.target.value);
                setSelectedMatchId("");
              }}
            >
              <option value="">Selecione</option>
              {championships.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.year} - {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Partida
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
              value={selectedMatchId}
              onChange={(event) => setSelectedMatchId(event.target.value)}
            >
              <option value="">Selecione</option>
              {matches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.playedAt} - {item.status === "finished" ? "finalizada" : "aberta"}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {isAdmin && showMatchOps ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Novo campeonato</h2>
            <form onSubmit={handleCreateChampionship} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Nome
                <input
                  required
                  value={championshipForm.name}
                  onChange={(event) => setChampionshipForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Ano
                <input
                  required
                  type="number"
                  value={championshipForm.year}
                  onChange={(event) => setChampionshipForm((prev) => ({ ...prev, year: Number(event.target.value) }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                />
              </label>
              <button className="w-full rounded-xl bg-[#17346b] px-3 py-2.5 font-semibold text-white transition hover:bg-[#10254f]" type="submit">
                Criar campeonato
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Nova partida</h2>
            <form onSubmit={handleCreateMatch} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Data da partida
                <input
                  required
                  type="date"
                  value={matchFormDate}
                  onChange={(event) => setMatchFormDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                />
              </label>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Participantes</p>
                <div className="flex max-h-36 flex-wrap gap-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {activePlayers.map((player) => {
                    const checked = selectedParticipantIds.includes(player.id);
                    return (
                      <label
                        key={player.id}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                          checked
                            ? "border-[#1c4e87] bg-[#d9e8f7] text-[#10254f]"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedParticipantIds((prev) =>
                              checked ? prev.filter((id) => id !== player.id) : [...prev, player.id],
                            )
                          }
                        />
                        {player.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <button className="w-full rounded-xl bg-[#17346b] px-3 py-2.5 font-semibold text-white transition hover:bg-[#10254f]" type="submit">
                Abrir partida
              </button>
            </form>
          </article>
        </section>
      ) : null}

      {showMatchOps ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Eventos da rodada</h2>
            <form onSubmit={handleRegisterElimination} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Jogador eliminado
                <select
                  required
                  value={eliminationForm.playerId}
                  onChange={(event) => setEliminationForm((prev) => ({ ...prev, playerId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                >
                  <option value="">Selecione</option>
                  {selectedMatchRemaining.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Quem eliminou
                <select
                  value={eliminationForm.eliminatedByUserId}
                  onChange={(event) =>
                    setEliminationForm((prev) => ({
                      ...prev,
                      eliminatedByUserId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                >
                  <option value="">Sem nocaute / desconhecido</option>
                  {selectedMatchRemaining.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="w-full rounded-xl bg-[#17346b] px-3 py-2.5 font-semibold text-white transition hover:bg-[#10254f] disabled:cursor-not-allowed disabled:bg-slate-300"
                type="submit"
                disabled={!selectedMatchId || selectedMatch?.status === "finished"}
              >
                Registrar eliminacao
              </button>
            </form>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Ordem</th>
                    <th className="px-3 py-2">Jogador</th>
                    <th className="px-3 py-2">Eliminador</th>
                  </tr>
                </thead>
                <tbody>
                  {eliminations.map((item) => {
                    const player = users.find((user) => user.id === item.playerId);
                    const eliminator = users.find((user) => user.id === item.eliminatedByUserId);
                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">{item.eliminationOrder}</td>
                        <td className="px-3 py-2">{player?.name ?? item.playerId}</td>
                        <td className="px-3 py-2">{eliminator?.name ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isAdmin ? (
              <button
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleFinishMatch}
                disabled={!selectedMatchId || selectedMatch?.status === "finished"}
              >
                Finalizar partida
              </button>
            ) : null}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Placar da partida</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Jogador</th>
                    <th className="px-3 py-2">Posicao</th>
                    <th className="px-3 py-2">Nocautes</th>
                    <th className="px-3 py-2">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {matchScores.map((score) => {
                    const player = users.find((user) => user.id === score.userId);
                    return (
                      <tr key={score.userId} className="border-t border-slate-200">
                        <td className="px-3 py-2">{player?.name ?? score.userId}</td>
                        <td className="px-3 py-2">{score.position}</td>
                        <td className="px-3 py-2">{score.knockouts}</td>
                        <td className="px-3 py-2 font-semibold text-[#17346b]">{score.totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {showRanking ? (
        <section className="grid gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Ranking anual</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Jogador</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Partidas</th>
                    <th className="px-3 py-2">KO</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row, index) => {
                    const player = users.find((user) => user.id === row.userId);
                    return (
                      <tr key={row.userId} className="border-t border-slate-200">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2">{player?.name ?? row.userId}</td>
                        <td className="px-3 py-2 font-semibold text-[#17346b]">{row.totalPoints}</td>
                        <td className="px-3 py-2">{row.matches}</td>
                        <td className="px-3 py-2">{row.knockouts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selectedChampionship ? (
              <p className="mt-3 rounded-xl bg-[#f3ead3] px-3 py-2 text-sm text-[#17346b]">
                Pontuacao inicial carregada para {Object.keys(seedMap).length} jogador(es).
              </p>
            ) : null}
          </article>
        </section>
      ) : null}

      {showParticipants ? (
        isAdmin ? (
          <section className="grid gap-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-[#10254f]">Participantes e aprovacao</h2>
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Perfil</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Aprovado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={user.role}
                            onChange={(event) => void handleRoleChange(user.id, event.target.value as "admin" | "player")}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-800"
                          >
                            <option value="player">jogador</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              user.active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {user.active ? "Aprovado" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={user.active}
                            onChange={(event) => void handleActiveToggle(user.id, event.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {users.map((user) => (
                  <article key={user.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          user.active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {user.active ? "Aprovado" : "Pendente"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="text-xs font-medium text-slate-600">
                        Perfil
                        <select
                          value={user.role}
                          onChange={(event) => void handleRoleChange(user.id, event.target.value as "admin" | "player")}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                        >
                          <option value="player">jogador</option>
                          <option value="admin">admin</option>
                        </select>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={user.active}
                          onChange={(event) => void handleActiveToggle(user.id, event.target.checked)}
                        />
                        Conta aprovada
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              <h3 className="mb-2 mt-4 text-base font-semibold text-[#10254f]">Importar pontuacao acumulada</h3>
              <form className="space-y-3" onSubmit={handleSeedImport}>
                <label className="block text-sm font-medium text-slate-700">
                  JSON no formato {`{"userId": pontos}`}
                  <textarea
                    rows={6}
                    value={seedText}
                    onChange={(event) => setSeedText(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-200 transition focus:ring"
                  />
                </label>
                <button className="w-full rounded-xl bg-[#17346b] px-3 py-2.5 font-semibold text-white transition hover:bg-[#10254f]" type="submit">
                  Importar pontuacao inicial
                </button>
              </form>
            </article>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Somente administradores podem gerenciar participantes e aprovacoes.
          </section>
        )
      ) : null}
    </main>
  );
}
