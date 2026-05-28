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
  expansion: number;
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
};

export type GameStateSnapshot = {
  gameId: string;
  status: "PLACING" | "ACTIVE";
  width: number;
  height: number;
  currentTurn: number;
  turnEndsAt: number;
  players: GamePlayerState[];
  tiles: {
    types: number[];
    owners: (string | null)[];
    buildings: (number | null)[];
    contestedUntil: (number | null)[];
  };
  claims: Record<string, Array<{ x: number; y: number }>>;
  pendingBuilds: Record<string, Array<{ x: number; y: number; building: number }>>;
  brouillage: Array<{ casterPlayerId: string; x: number; y: number; untilTurn: number }>;
};
