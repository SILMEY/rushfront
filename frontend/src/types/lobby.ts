export type CivilizationId = "iron_dwarves" | "sylvan_elves" | "steppe_horde" | "aurelian_empire";

export type LobbyPlayer = {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  color: string;
  civilization: CivilizationId;
  isReady: boolean;
  isBot?: boolean;
  quickGamesPlayed?: number;
};

export type LobbySummary = {
  id: string;
  status: "LOBBY" | "PLACING" | "ACTIVE" | "FINISHED";
  hostUserId: string;
  playerCount: number;
  players: LobbyPlayer[];
};

