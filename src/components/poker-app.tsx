"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  setUserActive,
  setUserRole,
  seedInitialRanking,
  upsertUserProfile,
} from "@/lib/data";
import type { AppUser, Championship, EliminationEvent, Match, MatchScore, RankingRow } from "@/lib/types";

type Flash = { type: "error" | "success"; message: string } | null;

const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export function PokerApp() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [seedMap, setSeedMap] = useState<Record<string, number>>({});
  const [selectedChampionshipId, setSelectedChampionshipId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
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

  const [championshipForm, setChampionshipForm] = useState({ name: "Campeonato", year: new Date().getFullYear() });
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

  const selectedMatchRemaining = useMemo(() => {
    if (!selectedMatch) {
      return [] as AppUser[];
    }
    const eliminated = new Set(eliminations.map((item) => item.playerId));
    return users.filter((item) => selectedMatch.participantIds.includes(item.id) && !eliminated.has(item.id));
  }, [eliminations, selectedMatch, users]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (current) => {
      setAuthUser(current);
      if (!current || !current.email) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const role = adminEmails.includes(current.email.toLowerCase()) ? "admin" : "player";
      const userProfile = await upsertUserProfile({
        uid: current.uid,
        email: current.email,
        name: current.displayName ?? current.email.split("@")[0],
        role,
      });

      setProfile(userProfile);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }
    void (async () => {
      const [profileSnap, usersSnap, championshipsSnap] = await Promise.all([
        getUserProfile(profile.id),
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
    })();
  }, [profile, selectedChampionshipId]);

  useEffect(() => {
    if (!selectedChampionshipId) {
      return;
    }
    void (async () => {
      const [matchesSnap, rankingSnap, seedSnap] = await Promise.all([
        listMatches(selectedChampionshipId),
        calculateChampionshipRanking(selectedChampionshipId),
        readRankingSeed(selectedChampionshipId),
      ]);

      setMatches(matchesSnap);
      setSeedMap(seedSnap);

      const merged = rankingSnap.map((item) => ({
        ...item,
        totalPoints: item.totalPoints + (seedSnap[item.userId] ?? 0),
      }));

      Object.entries(seedSnap).forEach(([userId, points]) => {
        if (merged.some((row) => row.userId === userId)) {
          return;
        }
        merged.push({ userId, totalPoints: points, matches: 0, knockouts: 0 });
      });

      merged.sort((a, b) => b.totalPoints - a.totalPoints);
      setRanking(merged);

      if (!selectedMatchId && matchesSnap.length > 0) {
        setSelectedMatchId(matchesSnap[0].id);
      }
    })();
  }, [selectedChampionshipId, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) {
      return;
    }
    void (async () => {
      const [eliminationsSnap, scores] = await Promise.all([
        listEliminations(selectedMatchId),
        calculateMatchScores(selectedMatchId),
      ]);
      setEliminations(eliminationsSnap);
      setMatchScores(scores);
    })();
  }, [selectedMatchId]);

  async function refreshCoreData(uid: string) {
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
  }

  async function refreshChampionshipData(championshipId: string) {
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
      if (merged.some((row) => row.userId === userId)) {
        return;
      }
      merged.push({ userId, totalPoints: points, matches: 0, knockouts: 0 });
    });

    merged.sort((a, b) => b.totalPoints - a.totalPoints);
    setRanking(merged);

    if (!selectedMatchId && matchesSnap.length > 0) {
      setSelectedMatchId(matchesSnap[0].id);
    }
  }

  async function refreshMatchData(matchId: string) {
    const [eliminationsSnap, scores] = await Promise.all([listEliminations(matchId), calculateMatchScores(matchId)]);
    setEliminations(eliminationsSnap);
    setMatchScores(scores);
  }

  function showError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    setFlash({ type: "error", message });
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlash(null);
    try {
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

  async function handleLogout() {
    await signOut(auth);
    setProfile(null);
    setAuthUser(null);
    setSelectedChampionshipId("");
    setSelectedMatchId("");
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
      setFlash({ type: "success", message: "Championship created." });
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
      setFlash({ type: "error", message: "Select at least two participants." });
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
      setFlash({ type: "success", message: "Match opened." });
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
      setFlash({ type: "success", message: "Elimination registered." });
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
      setFlash({ type: "success", message: "Match finished." });
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
      setFlash({ type: "success", message: "Seed imported." });
    } catch (error) {
      showError(error);
    }
  }

  if (loading) {
    return <div className="app-shell"><p>Loading...</p></div>;
  }

  if (!authUser || !profile) {
    return (
      <main className="auth-wrap">
        <section className="panel auth-panel">
          <h1>Poker Night Manager</h1>
          <p>Register matches, knockouts and year ranking.</p>
          <form onSubmit={handleAuthSubmit} className="grid-form">
            <label>
              Email
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={6}
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </label>
            {authForm.mode === "register" ? (
              <label>
                Name
                <input
                  required
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
            ) : null}
            <button type="submit" className="btn-primary">
              {authForm.mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            className="btn-secondary"
            onClick={() =>
              setAuthForm((prev) => ({
                ...prev,
                mode: prev.mode === "login" ? "register" : "login",
              }))
            }
          >
            {authForm.mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
          {flash ? <p className={flash.type === "error" ? "flash-error" : "flash-success"}>{flash.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>Poker Championship Control</h1>
          <p>
            {profile.name} · {profile.role}
          </p>
        </div>
        <button className="btn-secondary" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      {flash ? <p className={flash.type === "error" ? "flash-error" : "flash-success"}>{flash.message}</p> : null}

      <section className="panel row-wrap">
        <label>
          Championship
          <select
            value={selectedChampionshipId}
            onChange={(event) => {
              setSelectedChampionshipId(event.target.value);
              setSelectedMatchId("");
            }}
          >
            <option value="">Select</option>
            {championships.map((item) => (
              <option key={item.id} value={item.id}>
                {item.year} - {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Match
          <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
            <option value="">Select</option>
            {matches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.playedAt} - {item.status}
              </option>
            ))}
          </select>
        </label>
      </section>

      {profile.role === "admin" ? (
        <section className="grid-two">
          <article className="panel">
            <h2>Open Championship</h2>
            <form onSubmit={handleCreateChampionship} className="grid-form">
              <label>
                Name
                <input
                  required
                  value={championshipForm.name}
                  onChange={(event) => setChampionshipForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label>
                Year
                <input
                  required
                  type="number"
                  value={championshipForm.year}
                  onChange={(event) => setChampionshipForm((prev) => ({ ...prev, year: Number(event.target.value) }))}
                />
              </label>
              <button className="btn-primary" type="submit">
                Create championship
              </button>
            </form>
          </article>

          <article className="panel">
            <h2>Open Match</h2>
            <form onSubmit={handleCreateMatch} className="grid-form">
              <label>
                Match date
                <input
                  required
                  type="date"
                  value={matchFormDate}
                  onChange={(event) => setMatchFormDate(event.target.value)}
                />
              </label>
              <div>
                <p>Participants</p>
                <div className="chip-list">
                  {activePlayers.map((player) => {
                    const checked = selectedParticipantIds.includes(player.id);
                    return (
                      <label key={player.id} className="chip">
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
              <button className="btn-primary" type="submit">
                Create match
              </button>
            </form>
          </article>
        </section>
      ) : null}

      <section className="grid-two">
        <article className="panel">
          <h2>Night Events</h2>
          <form onSubmit={handleRegisterElimination} className="grid-form">
            <label>
              Eliminated player
              <select
                required
                value={eliminationForm.playerId}
                onChange={(event) => setEliminationForm((prev) => ({ ...prev, playerId: event.target.value }))}
              >
                <option value="">Select</option>
                {selectedMatchRemaining.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Eliminated by
              <select
                value={eliminationForm.eliminatedByUserId}
                onChange={(event) =>
                  setEliminationForm((prev) => ({
                    ...prev,
                    eliminatedByUserId: event.target.value,
                  }))
                }
              >
                <option value="">No knockout / unknown</option>
                {selectedMatchRemaining.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn-primary" type="submit" disabled={!selectedMatchId || selectedMatch?.status === "finished"}>
              Register elimination
            </button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Player</th>
                  <th>Eliminator</th>
                </tr>
              </thead>
              <tbody>
                {eliminations.map((item) => {
                  const player = users.find((user) => user.id === item.playerId);
                  const eliminator = users.find((user) => user.id === item.eliminatedByUserId);
                  return (
                    <tr key={item.id}>
                      <td>{item.eliminationOrder}</td>
                      <td>{player?.name ?? item.playerId}</td>
                      <td>{eliminator?.name ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {profile.role === "admin" ? (
            <button className="btn-secondary" onClick={handleFinishMatch} disabled={!selectedMatchId || selectedMatch?.status === "finished"}>
              Finish match
            </button>
          ) : null}
        </article>

        <article className="panel">
          <h2>Match Scoreboard</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Position</th>
                  <th>Knockouts</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {matchScores.map((score) => {
                  const player = users.find((user) => user.id === score.userId);
                  return (
                    <tr key={score.userId}>
                      <td>{player?.name ?? score.userId}</td>
                      <td>{score.position}</td>
                      <td>{score.knockouts}</td>
                      <td>{score.totalPoints}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid-two">
        <article className="panel">
          <h2>Year Ranking</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Total</th>
                  <th>Matches</th>
                  <th>KO</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => {
                  const player = users.find((user) => user.id === row.userId);
                  return (
                    <tr key={row.userId}>
                      <td>{index + 1}</td>
                      <td>{player?.name ?? row.userId}</td>
                      <td>{row.totalPoints}</td>
                      <td>{row.matches}</td>
                      <td>{row.knockouts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selectedChampionship ? <p className="note">Seed points loaded: {Object.keys(seedMap).length}</p> : null}
        </article>

        {profile.role === "admin" ? (
          <article className="panel">
            <h2>Participants and Roles</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>
                        <select value={user.role} onChange={(event) => void handleRoleChange(user.id, event.target.value as "admin" | "player") }>
                          <option value="player">player</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
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

            <h3>Import running score</h3>
            <form className="grid-form" onSubmit={handleSeedImport}>
              <label>
                JSON map userId: points
                <textarea rows={6} value={seedText} onChange={(event) => setSeedText(event.target.value)} />
              </label>
              <button className="btn-secondary" type="submit">
                Import seed
              </button>
            </form>
          </article>
        ) : null}
      </section>
    </main>
  );
}
