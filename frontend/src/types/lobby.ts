export type LobbyPlayer = {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  color: string;
  isReady: boolean;
};

export type LobbySummary = {
  id: string;
  status: "LOBBY" | "PLACING" | "ACTIVE" | "FINISHED";
  hostUserId: string;
  playerCount: number;
  players: LobbyPlayer[];
};

