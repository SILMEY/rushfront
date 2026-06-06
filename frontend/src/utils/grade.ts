export interface Grade {
  key: string;
  min: number;
  color: string;
  icon: string;
}

export const GRADES: Grade[] = [
  { key: "emperor", min: 501, color: "#f59e0b", icon: "🌟" },
  { key: "king",    min: 201, color: "#f97316", icon: "👑" },
  { key: "prince",  min: 151, color: "#ec4899", icon: "🔮" },
  { key: "count",   min: 101, color: "#8b5cf6", icon: "💎" },
  { key: "baron",   min: 81,  color: "#d4af37", icon: "🏆" },
  { key: "marshal", min: 51,  color: "#06b6d4", icon: "⚜️" },
  { key: "captain", min: 30,  color: "#22c55e", icon: "🎖️" },
  { key: "knight",  min: 15,  color: "#3b82f6", icon: "⚔️" },
  { key: "squire",  min: 6,   color: "#94a3b8", icon: "🛡️" },
  { key: "peon",    min: 0,   color: "#6b7280", icon: "⚒️" },
];

export function getGrade(gamesPlayed: number): Grade {
  for (const g of GRADES) {
    if (gamesPlayed >= g.min) return g;
  }
  return GRADES[GRADES.length - 1]!;
}
