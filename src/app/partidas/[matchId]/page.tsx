import { PokerApp } from "@/components/poker-app";

export default async function PartidaDetalhePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <PokerApp view="partidas" exclusiveMatchId={matchId} />;
}
