"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { AppHeader } from "@/components/app-header";
import { MainMenu } from "@/components/main-menu";
import { getUserProfile } from "@/lib/data";
import { auth } from "@/lib/firebase";

export default function ManualPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [subtitle, setSubtitle] = useState("Manual do sistema");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/");
        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);
        const admin = profile?.role === "admin";
        setIsAdmin(admin);
        setSubtitle(`${profile?.name ?? currentUser.displayName ?? "Usuario"} · ${admin ? "Administrador" : "Jogador"}`);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  async function handleLogout() {
    await signOut(auth);
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-4 md:px-6">
        <div className="rounded-2xl border border-slate-300 bg-white px-6 py-5 shadow-lg">
          <p className="text-slate-700">Carregando manual...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6">
      <AppHeader subtitle={subtitle} onLogout={handleLogout} />

      <MainMenu isAdmin={isAdmin} />

      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#10254f]">Manual do sistema</h2>
        <p className="mt-1 text-sm text-slate-600">
          Guia operacional completo para administrar usuarios, campeonatos, partidas e ranking com seguranca.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">1. Fluxo diario de uso</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Entre com email/senha ou conta Google.</li>
            <li>Se a conta estiver pendente, aguarde aprovacao de um administrador.</li>
            <li>Na tela Partidas, selecione o campeonato em uso naquela temporada.</li>
            <li>Abra uma nova partida com pelo menos dois participantes ativos.</li>
            <li>Durante a rodada, registre as eliminacoes na ordem real em que acontecerem.</li>
            <li>Quando restarem dois jogadores, nao registre novos nocautes.</li>
            <li>Finalize a partida para consolidar a pontuacao e atualizar o ranking anual.</li>
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">2. Permissoes</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              <strong>Administrador:</strong> cria e exclui campeonatos, abre/finaliza/exclui partidas, aprova
              participantes, altera papeis e importa pontuacao acumulada.
            </p>
            <p>
              <strong>Jogador:</strong> visualiza ranking e partidas, acompanha resultados e registra apenas eventos
              permitidos no fluxo da rodada.
            </p>
            <p>
              Acoes sensiveis exigem perfil admin tambem nas regras do Firestore. Nao basta esconder o botao na tela.
            </p>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-[#17346b]">3. Operacao por area</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Acesso e aprovacao</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Cadastros novos entram como jogador pendente.</li>
              <li>O admin aprova na pagina Participantes ativando o usuario.</li>
              <li>Emails definidos em NEXT_PUBLIC_ADMIN_EMAILS entram como admin na primeira autenticacao.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Campeonatos</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Somente admins podem criar um novo campeonato anual.</li>
              <li>Sempre confirme ano e nome antes de iniciar as partidas.</li>
              <li>A exclusao do campeonato remove partidas, nocautes e carga inicial desse periodo.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Cadastro de partida</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Selecione a data da rodada.</li>
              <li>Marque pelo menos 2 participantes ativos.</li>
              <li>Abra a partida e confira se ela aparece como aberta no seletor.</li>
              <li>Use a tela exclusiva da partida quando quiser focar apenas no controle da mesa.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Registro de eliminacoes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Toque ou clique no jogador eliminado na mesa.</li>
              <li>Informe quem eliminou, ou deixe em branco se o eliminador nao for conhecido.</li>
              <li>Use Desfazer ultimo KO para corrigir o ultimo registro da rodada.</li>
              <li>Quando restarem 2 jogadores, o sistema bloqueia novos KOs.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Fechamento e ranking</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Finalize a partida somente depois de conferir a ordem de eliminacoes.</li>
              <li>O placar final passa a considerar pontos de posicao e bonus por nocaute.</li>
              <li>Valide o resultado na tela Ranking para confirmar a atualizacao acumulada.</li>
              <li>Use a carga inicial apenas para ajustes historicos autorizados.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Exclusoes administrativas</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Partida: use o fluxo de confirmacao em duas etapas para remover a rodada e seus nocautes.</li>
              <li>Campeonato: use Excluir campeonato e confirme a remocao em duas etapas.</li>
              <li>Ao excluir um campeonato, o ranking desse periodo e a carga inicial relacionada deixam de existir.</li>
              <li>Jogadores nunca devem compartilhar credenciais para preservar a rastreabilidade.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-[#10254f]">Participantes e importacao</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Aprovacao e troca de papel acontecem na area Participantes.</li>
              <li>Jogador com historico deve ser inativado em vez de removido da base.</li>
              <li>Use o arquivo modelo para importacao em lote e revise emails antes de enviar.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">4. Checklist do admin</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Aprovar participantes pendentes antes do inicio da rodada.</li>
            <li>Confirmar o campeonato selecionado antes de abrir uma nova partida.</li>
            <li>Registrar ou supervisionar os nocautes em ordem cronologica.</li>
            <li>Finalizar a partida apenas apos revisao do historico.</li>
            <li>Usar exclusoes somente quando for necessario corrigir dados da competicao.</li>
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-[#17346b]">5. Suporte operacional</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>Se a tela nao mostrar dados, verifique se o usuario foi aprovado e se o campeonato correto esta selecionado.</p>
            <p>Se um registro de KO estiver incorreto e ainda for o ultimo evento, use Desfazer ultimo KO antes de continuar.</p>
            <p>
              {isAdmin
                ? "Voce esta vendo o manual com privilegios de administrador, incluindo operacoes de exclusao e aprovacao."
                : "Seu perfil atual nao mostra a pagina Participantes nem operacoes administrativas sensiveis."}
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
