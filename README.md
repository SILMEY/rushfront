# Frontrush (v1)

Monorepo `backend` (Node.js + Fastify + Socket.IO + Prisma/Postgres) et `frontend` (Vue 3 + Vite + Tailwind + Pinia + Router + Canvas).

## Arborescence

```
.
├─ backend/
│  ├─ prisma/
│  │  ├─ migrations/
│  │  └─ schema.prisma
│  ├─ src/
│  │  ├─ app.ts
│  │  ├─ server.ts
│  │  ├─ auth/
│  │  ├─ config/
│  │  ├─ game/
│  │  ├─ prisma/
│  │  └─ sockets/
│  ├─ .env.example
│  ├─ package.json
│  └─ tsconfig.json
├─ frontend/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/game/
│  │  ├─ composables/
│  │  ├─ layouts/
│  │  ├─ pages/
│  │  ├─ router/
│  │  ├─ stores/
│  │  ├─ types/
│  │  └─ utils/
│  ├─ .env.example
│  ├─ index.html
│  ├─ package.json
│  ├─ tailwind.config.cjs
│  └─ vite.config.ts
├─ docker-compose.yml
└─ package.json
```

## Prérequis

- Node.js 20+
- Docker Desktop (pour PostgreSQL)
- Un projet Google Cloud avec OAuth 2.0

## Installation

À la racine :

```bash
npm install
```

## PostgreSQL

```bash
docker compose up -d
```

## Tout lancer en containers (DB + backend + frontend)

1) À la racine, crée un `.env` à partir de `.env.example` et renseigne au minimum :
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

2) Lance tout :

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/healthz`
- PostgreSQL exposé en local sur `5433` (pour éviter les conflits avec un Postgres local sur `5432`)

Notes:
- Le redirect OAuth doit rester `http://localhost:3000/auth/google/callback`.
- En mode containers, le backend applique automatiquement les migrations Prisma au démarrage.

## Backend (Prisma + dev)

```bash
cd backend
copy .env.example .env
```

Puis configure `.env` (voir section Google OAuth).

Créer la base (migrations) + client Prisma :

```bash
npm run prisma:generate
npm run prisma:migrate
```

Lancer :

```bash
npm run dev
```

## Frontend

```bash
cd frontend
copy .env.example .env
npm run dev
```

Ouvre `http://localhost:5173`.

## Google OAuth (dev)

Dans Google Cloud Console :

- OAuth consent screen : configuré
- Credentials → OAuth client ID → Web application
- Authorized JavaScript origins :
  - `http://localhost:3000`
  - `http://localhost:5173`
- Authorized redirect URIs :
  - `http://localhost:3000/auth/google/callback`

Dans `backend/.env` :

- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URL=http://localhost:3000/auth/google/callback`
- `WEB_ORIGIN=http://localhost:5173`
- `JWT_SECRET=...` (min 16 chars)
- `DATABASE_URL=postgresql://territory:territory@127.0.0.1:5433/territory_rush?schema=public&sslmode=disable`
  - Note: ce repo expose PostgreSQL sur `5433` (Docker) pour éviter les conflits si un PostgreSQL local tourne déjà sur `5432`.

## Gameplay v1

- Crée une partie depuis l’accueil.
- Ouvre le lobby, mets-toi prêt, lance la partie (2+ joueurs prêts).
- Phase placement : clique une case plaine pour placer la base (B).
- Phase active :
  - Clique une case adjacente neutre pour la revendiquer (couleur claire).
  - Le serveur résout automatiquement toutes les 10s (contesté si 2 joueurs sur la même case).
  - Sélectionne un bâtiment puis clique une case possédée pour construire (instantané à la résolution).

## Notes d’architecture (v1)

- Backend autoritaire : le client envoie des intentions, le serveur valide au tick de fin de tour.
- Choix documenté dans `backend/src/game/turnResolver.ts` : les ressources produites à la résolution sont utilisables au tour suivant.
- Caserne : points locaux (3 par caserne) dépensés en priorité pour les claims dans un rayon de 10.

## Améliorations (prochaines itérations)

- Deltas d’état (au lieu de renvoyer toute la map à chaque action).
- Persistance de l’état complet de carte (tables + snapshots/events).
- Reconnexion robuste (rejoin rooms, rechargement instance depuis DB).
- UI: log d’événements, liste joueurs, tooltips plus riches, mini-map.
