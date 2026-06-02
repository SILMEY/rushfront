export type TechId = "eco_tools" | "cote_de_maille" | "epee_longue" | "pont";

export type TechDef = {
  id: TechId;
  name: string;
  description: string;
  cost: { wood: number; stone: number };
  stackable?: boolean;
};

export const TECHS: TechDef[] = [
  {
    id: "eco_tools",
    name: "Outils améliorés",
    description: "+1 bois par scierie, +1 pierre par mine (par seconde).",
    cost: { wood: 30, stone: 10 }
  },
  {
    id: "cote_de_maille",
    name: "Cote de mailles",
    description: "Réduit de moitié vos pertes militaires quand vous êtes attaqué.",
    cost: { wood: 20, stone: 40 }
  },
  {
    id: "epee_longue",
    name: "Épée longue",
    description: "Réduit de moitié vos pertes militaires quand vous attaquez.",
    cost: { wood: 40, stone: 20 }
  },
  {
    id: "pont",
    name: "Pont",
    description: "Permet de revendiquer une case d'eau adjacente (1 charge par achat).",
    cost: { wood: 15, stone: 10 },
    stackable: true
  }
];

export function isTechId(value: string): value is TechId {
  return (TECHS as Array<{ id: string }>).some((t) => t.id === value);
}
