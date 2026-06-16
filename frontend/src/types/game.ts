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
  University = 6,
  City = 7,
  Wonder = 8,
  Bridge = 9,
  Catapult = 10
}

export type Vec2 = { x: number; y: number };

export type GalleonState = {
  id: string;
  playerId: string;
  portKey: string;
  x: number;
  y: number;
  hp: number;
};

export type LandUnitState = {
  id: string;
  playerId: string;
  civilization: string;
  barracksKey: string;
  x: number;
  y: number;
  hp: number;
};

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
  bridgeCharges?: number;
  portFishingBoats?: Record<string, number>; // key: "${x}_${y}"
  portTransports?: Record<string, number>;   // key: "${x}_${y}"
  maritimeCharges?: number;
  cursedForestCooldownEnds?: number;
};

export type GameStateSnapshot = {
  gameId: string;
  status: "PLACING" | "ACTIVE" | "FINISHED";
  gameType?: "quick" | "custom";
  placingEndsAt?: number;
  wonders?: Array<{ playerId: string; endsAt: number }>;
  width: number;
  height: number;
  players: GamePlayerState[];
  tiles: {
    types: number[];
    owners: (string | null)[];
    buildings: (number | null)[];
  };
  brouillage: Array<{ casterPlayerId: string; x: number; y: number; expiresAt: number }>;
  galleons: GalleonState[];
  landUnits: LandUnitState[];
};

export type LandUnitsUpdateEvent = { units: LandUnitState[] };
export type CatapultFireEvent    = { center: Vec2; changes: TileChangePatch[] };
export type CurseAppliedEvent    = { changes: TileChangePatch[]; playerId: string };

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
  players: Array<{ id: string; resources: PlayerResources; maritimeCharges?: number; portFishingBoats?: Record<string, number>; portTransports?: Record<string, number> }>;
  wonders?: Array<{ playerId: string; endsAt: number }>;
};

export type ResourceUpdateEvent = {
  players: Array<{ id: string; resources: PlayerResources }>;
};

// Lightweight player-only patch (tech purchase, boat purchase, etc.)
export type PlayerUpdateEvent = {
  player: { id: string } & Partial<GamePlayerState>;
};

// Brouillage patch — only the newly-added entries
export type BrouillagePatchEvent = {
  added: Array<{ casterPlayerId: string; x: number; y: number; expiresAt: number }>;
};
