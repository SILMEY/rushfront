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

export type Tile = {
  type: TileType;
  ownerPlayerId: string | null;
  building: BuildingType | null;
  contestedUntilTurn: number | null;
};

export type PlayerResources = {
  villagers: number;
  soldiers: number;
  wood: number;
  stone: number;
};

export type GamePlayerState = {
  id: string; // GamePlayer.id
  userId: string;
  name: string;
  avatarUrl?: string | null;
  color: string;
  isReady: boolean;
  hasChosenStart: boolean;
  basePosition: Vec2 | null;
  resources: PlayerResources;
};

export type ClaimIntent = {
  x: number;
  y: number;
};

export type BuildIntent = {
  x: number;
  y: number;
  building: BuildingType;
};

export type GameStateSnapshot = {
  gameId: string;
  status: "PLACING" | "ACTIVE";
  width: number;
  height: number;
  currentTurn: number;
  turnEndsAt: number; // unix ms
  players: GamePlayerState[];
  tiles: {
    types: number[]; // length w*h (TileType)
    owners: (string | null)[]; // length w*h (GamePlayer.id)
    buildings: (number | null)[]; // length w*h (BuildingType)
    contestedUntil: (number | null)[]; // length w*h
  };
  claims: Record<string, ClaimIntent[]>; // by playerId
  pendingBuilds: Record<string, BuildIntent[]>; // by playerId
  brouillage: Array<{ casterPlayerId: string; x: number; y: number; untilTurn: number }>;
};
