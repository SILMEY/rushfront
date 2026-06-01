export type TechId = "eco_tools" | "mil_training" | "logistics";

export type TechDef = {
  id: TechId;
  name: string;
  description: string;
  cost: { wood: number; stone: number };
};

export const TECHS: TechDef[] = [
  {
    id: "eco_tools",
    name: "Outils améliorés",
    description: "+1 bois par scierie, +1 pierre par mine (par tour).",
    cost: { wood: 30, stone: 10 }
  },
  {
    id: "mil_training",
    name: "Entraînement",
    description: "+1 militaire par tour.",
    cost: { wood: 20, stone: 20 }
  },
  {
    id: "logistics",
    name: "Logistique",
    description: "Réduction coût revendication (militaires) de -1 (min 1).",
    cost: { wood: 40, stone: 0 }
  }
];

export function isTechId(value: string): value is TechId {
  return (TECHS as Array<{ id: string }>).some((t) => t.id === value);
}

