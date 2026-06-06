export type User = {
  id: string;
  email: string;
  name: string;
  pseudo?: string | null;
  avatarUrl?: string | null;
  preferredColor?: string | null;
  preferredCivilization?: string | null;
  isAdmin?: boolean;
  elo?: number;
  quickGamesPlayed?: number;
};
