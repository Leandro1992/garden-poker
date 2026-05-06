# Poker Championship Manager

Aplicacao web para registrar partidas presenciais de poker e acompanhar ranking anual acumulado.

## Stack
- Next.js (App Router)
- Firebase Authentication (Email/Senha)
- Firebase Firestore
- Vitest para testes das regras de pontuacao e ranking

## Funcionalidades MVP
- Cadastro e login por email/senha.
- Cadastro e login com Google.
- Controle por papel (`admin` e `player`).
- Fluxo de aprovacao: novo jogador entra como pendente e aguarda aprovacao do admin.
- Cadastro de campeonato anual.
- Exclusao de campeonato por admin com limpeza de partidas, eliminacoes e seeds de ranking vinculados.
- Abertura de partidas por campeonato.
- Exclusao de partidas por admin com confirmacao em duas etapas.
- Selecao de participantes presentes na rodada.
- Registro cronologico de eliminacoes.
- Bonus de nocaute (+2 pontos por eliminacao).
- Ranking da noite (partida) e ranking do ano (campeonato).
- Importacao de pontuacao inicial para campeonato em andamento.

## Operacao do sistema
1. O usuario entra com email/senha ou Google.
2. Jogadores novos permanecem pendentes ate aprovacao de um admin.
3. O admin seleciona o campeonato ativo na tela Partidas.
4. O admin abre a partida escolhendo data e participantes ativos.
5. Durante a rodada, as eliminacoes sao registradas na ordem real.
6. Ao final, o admin finaliza a partida para consolidar o ranking.
7. Exclusoes de partida e campeonato exigem confirmacao em duas etapas e sao restritas a admins.

## Perfis e permissoes
- `admin`: aprova usuarios, altera perfis, cria e exclui campeonatos, abre/finaliza/exclui partidas e importa carga inicial.
- `player`: visualiza dados liberados, acompanha ranking e participa do fluxo operacional permitido.

## Excluir campeonato
- Disponivel apenas para `admin` na tela Partidas.
- Remove o campeonato selecionado, todas as partidas vinculadas, os registros de eliminacao e a carga inicial de ranking daquele periodo.
- A operacao exige confirmacao explicita na interface e tambem e protegida nas regras do Firestore.

## Configuracao
1. Copie `.env.example` para `.env.local`.
2. Preencha as variaveis Firebase com os dados do seu projeto.
3. No Firebase Console, habilite `Authentication > Email/Password`.
4. No Firebase Console, habilite `Authentication > Google`.
5. Crie o Firestore e publique `firestore.rules`.
6. Configure pelo menos um email admin em `NEXT_PUBLIC_ADMIN_EMAILS`.

## Rodando localmente
```bash
npm install
npm run dev
```

Aplicacao: `http://localhost:3000`

## Testes
```bash
npm run test
```

## Estrutura relevante
- `src/components/poker-app.tsx`: UI principal e fluxo de uso.
- `src/lib/data.ts`: operacoes do Firestore.
- `src/lib/ranking.ts`: regras de pontuacao e ranking.
- `src/lib/ranking.test.ts`: cobertura das regras criticas.
- `firestore.rules`: regras de seguranca por papel.
