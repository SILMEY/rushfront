export enum TileType {
  Plain = 0,
  Water = 1,
  Forest = 2,
  Quarry = 3
}

export enum BuildingType {
  Base = 1,
  FishingHut = 2,
  Sawmill = 3,
  Mine = 4,
  Barracks = 5,
  University = 6
}

export type Vec2 = { x: number; y: number };

export type PlayerResources = {
  villagers: number;
  soldiers: number;
  wood: number;
  stone: number;
};

export type GamePlayerState = {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  color: string;
  isReady: boolean;
  hasChosenStart: boolean;
  basePosition: Vec2 | null;
  resources: PlayerResources;
  techs?: string[];
  desiredSoldierPct?: number;
  eliminated?: boolean;
};

export type GameStateSnapshot = {
  gameId: string;
  status: "PLACING" | "ACTIVE" | "FINISHED";
  width: number;
  height: number;
  players: GamePlayerState[];
  tiles: {
    types: number[];
    owners: (string | null)[];
    buildings: (number | null)[];
  };
  brouillage: Array<{ casterPlayerId: string; x: number; y: number; expiresAt: number }>;
};

export type PlayerEliminatedEvent = {
  playerId: string;
  changes: TileChangePatch[];
};

export type GameOverEvent = {
  winnerId: string | null;
  winnerName: string | null;
};

// Lightweight patch events (no full snapshot needed)
export type TileChangePatch = {
  x: number;
  y: number;
  owner: string | null;
  building: number | null;
};

export type TileUpdateEvent = {
  changes: TileChangePatch[];
  players: Array<{ id: string; resources: PlayerResources }>;
};

export type ResourceUpdateEvent = {
  players: Array<{ id: string; resources: PlayerResources }>;
};
