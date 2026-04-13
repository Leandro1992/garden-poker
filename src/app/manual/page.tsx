"use client";

import { signOut } from "firebase/auth";

import { AppHeader } from "@/components/app-header";
import { MainMenu } from "@/components/main-menu";
import { auth } from "@/lib/firebase";

export default function ManualPage() {
  async function handleLogout() {
    await signOut(auth);
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 md:px-6">
      <AppHeader subtitle="Manual do sistema" onLogout={handleLogout} />

      <MainMenu />

      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-3xl font-semibold text-[#10254f]">Manual do sistema</h2>
        <p className="mt-2 text-sm text-slate-600">
          Guia rapido para operar o Garden Poker com seguranca e consistencia de dados.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">1. Como operar</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Entre com email/senha ou conta Google.</li>
            <li>No menu, escolha a tela de trabalho: Partidas, Ranking ou Participantes.</li>
            <li>Selecione o campeonato ativo e a partida que deseja registrar.</li>
            <li>Registre eliminacoes em ordem real para manter o placar correto.</li>
            <li>Ao finalizar a rodada, feche a partida para consolidar pontos e ranking.</li>
            <li>Para excluir partida, use o fluxo de confirmacao em duas etapas para evitar exclusao acidental.</li>
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">2. Permissoes</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              <strong>Administrador:</strong> cria campeonatos, abre/finaliza/exclui partidas, aprova participantes,
              altera papeis e importa pontuacao acumulada.
            </p>
            <p>
              <strong>Jogador:</strong> visualiza ranking e partidas, registra eventos permitidos no fluxo da
              rodada e acompanha resultados.
            </p>
            <p>
              Novos cadastros entram como pendentes e precisam de aprovacao de administrador para acesso completo.
            </p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-[#17346b]">3. Como registrar informacoes</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Cadastro de partida</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Selecione data da partida.</li>
              <li>Marque pelo menos 2 participantes ativos.</li>
              <li>Abra a partida e confira se ela aparece como aberta no seletor.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Registro de eliminacoes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Informe o jogador eliminado.</li>
              <li>Informe quem eliminou (ou deixe vazio se desconhecido).</li>
              <li>Repita ate restar apenas o vencedor.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Consolidacao do ranking</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Finalize a partida para confirmar os pontos.</li>
              <li>Valide o resultado na pagina Ranking.</li>
              <li>Use importacao inicial apenas para ajustes historicos autorizados.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Exclusao de partida (admin)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Selecione a partida no topo da tela de Partidas.</li>
              <li>Clique em Excluir partida para entrar no modo de confirmacao.</li>
              <li>Clique em Confirmar exclusao para concluir, ou em Cancelar para abortar.</li>
              <li>A exclusao remove a partida e todos os nocautes registrados nela.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Boas praticas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Registre eventos imediatamente durante a rodada.</li>
              <li>Evite contas compartilhadas para manter rastreabilidade.</li>
              <li>Nao altere papel ou aprovacao sem validacao do admin responsavel.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
