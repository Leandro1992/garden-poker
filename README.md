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
- Abertura de partidas por campeonato.
- Selecao de participantes presentes na rodada.
- Registro cronologico de eliminacoes.
- Bonus de nocaute (+2 pontos por eliminacao).
- Ranking da noite (partida) e ranking do ano (campeonato).
- Importacao de pontuacao inicial para campeonato em andamento.

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
