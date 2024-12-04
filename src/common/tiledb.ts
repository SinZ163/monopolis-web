export  interface GOSpace {
    type: "GO";
    id: string;
}
export interface JailSpace {
    type: "Jail";
    id: string;
}
export interface FreeParkingSpace {
    type: "FreeParking";
    id: string;
}
export interface GOTOJailSpace {
    type: "GOTOJail";
    id: string;
}
export interface EstateSpace {
    type: "Estate";
    id: string;
    category: string;
    purchasePrice: number;
    rent: number[];
}
export interface RailRoadSpace {
    type: "Railroad";
    id: string;
    purchasePrice: number;
}
export interface UtilitySpace {
    type: "Utility";
    id: string;
    purchasePrice: number;
    multipliers: number[];
}
export interface CardDrawSpace {
    type: "CardDraw";
    id: string;
    category: string;
}
export interface TaxSpace {
    type: "Tax";
    id: string;
    cost: number;
}
export type Space =
    | GOSpace
    | JailSpace
    | FreeParkingSpace
    | GOTOJailSpace
    | EstateSpace
    | RailRoadSpace
    | UtilitySpace
    | CardDrawSpace
    | TaxSpace;

export const TileDB: Space[] = [
    { type: "GO", id: "GO" },
    {
      type: "Estate",
      id: "BrownA",
      category: "Brown",
      purchasePrice: 60,
      rent: [2, 10, 30, 90, 160, 250],
    },
    { type: "CardDraw", id: "CommunityChestA", category: "CommunityChest" },
    {
      type: "Estate",
      id: "BrownB",
      category: "Brown",
      purchasePrice: 60,
      rent: [4, 20, 60, 180, 320, 450],
    },
    { type: "Tax", id: "IncomeTax", cost: 200 },
    { type: "Railroad", id: "RailroadA", purchasePrice: 200 },
    {
      type: "Estate",
      id: "LightBlueA",
      category: "LightBlue",
      purchasePrice: 100,
      rent: [6, 30, 90, 270, 400, 550],
    },
    { type: "CardDraw", id: "ChanceA", category: "Chance" },
    {
      type: "Estate",
      id: "LightBlueB",
      category: "LightBlue",
      purchasePrice: 100,
      rent: [6, 30, 90, 270, 400, 550],
    },
    {
      type: "Estate",
      id: "LightBlueC",
      category: "LightBlue",
      purchasePrice: 120,
      rent: [8, 40, 100, 300, 450, 600],
    },
    { type: "Jail", id: "Jail" },
    {
      type: "Estate",
      id: "PinkA",
      category: "Pink",
      purchasePrice: 140,
      rent: [10, 50, 150, 450, 625, 750],
    },
    { type: "Utility", id: "ElectricCompany", multipliers: [4, 10], purchasePrice: 150 },
    {
      type: "Estate",
      id: "PinkB",
      category: "Pink",
      purchasePrice: 140,
      rent: [10, 50, 150, 450, 625, 750],
    },
    {
      type: "Estate",
      id: "PinkC",
      category: "Pink",
      purchasePrice: 160,
      rent: [12, 60, 180, 500, 700, 900],
    },
    { type: "Railroad", id: "RailroadB", purchasePrice: 200 },
    {
      type: "Estate",
      id: "OrangeA",
      category: "Orange",
      purchasePrice: 180,
      rent: [14, 70, 200, 550, 750, 950],
    },
    { type: "CardDraw", id: "CommunityChestB", category: "CommunityChest" },
    {
      type: "Estate",
      id: "OrangeB",
      category: "Orange",
      purchasePrice: 180,
      rent: [14, 70, 200, 550, 750, 950],
    },
    {
      type: "Estate",
      id: "OrangeC",
      category: "Orange",
      purchasePrice: 200,
      rent: [16, 80, 220, 600, 800, 1000],
    },
    { type: "FreeParking", id: "FreeParking" },
    {
      type: "Estate",
      id: "RedA",
      category: "Red",
      purchasePrice: 220,
      rent: [18, 90, 250, 700, 875, 1050],
    },
    { type: "CardDraw", id: "ChanceB", category: "Chance" },
    {
      type: "Estate",
      id: "RedB",
      category: "Red",
      purchasePrice: 220,
      rent: [18, 90, 250, 700, 875, 1050],
    },
    {
      type: "Estate",
      id: "RedC",
      category: "Red",
      purchasePrice: 240,
      rent: [20, 100, 300, 750, 925, 1100],
    },
    { type: "Railroad", id: "RailroadC", purchasePrice: 200 },
    {
      type: "Estate",
      id: "YellowA",
      category: "Yellow",
      purchasePrice: 260,
      rent: [22, 110, 330, 800, 950, 1150],
    },
    {
      type: "Estate",
      id: "YellowB",
      category: "Yellow",
      purchasePrice: 260,
      rent: [22, 110, 330, 800, 950, 1150],
    },
    { type: "Utility", id: "Waterworks", multipliers: [4, 10], purchasePrice: 150 },
    {
      type: "Estate",
      id: "YellowC",
      category: "Yellow",
      purchasePrice: 280,
      rent: [24, 120, 360, 850, 1025, 1200],
    },
    { type: "GOTOJail", id: "GOTOJail" },
    {
      type: "Estate",
      id: "GreenA",
      category: "Green",
      purchasePrice: 300,
      rent: [26, 130, 390, 900, 1100, 1275],
    },
    {
      type: "Estate",
      id: "GreenB",
      category: "Green",
      purchasePrice: 300,
      rent: [26, 130, 390, 900, 1100, 1275],
    },
    { type: "CardDraw", id: "CommunityChestC", category: "CommunityChest" },
    {
      type: "Estate",
      id: "GreenC",
      category: "Green",
      purchasePrice: 320,
      rent: [28, 150, 450, 1000, 1200, 1400],
    },
    { type: "Railroad", id: "RailroadD", purchasePrice: 200 },
    { type: "CardDraw", id: "ChanceC", category: "Chance" },
    {
      type: "Estate",
      id: "DarkBlueA",
      category: "DarkBlue",
      purchasePrice: 350,
      rent: [35, 175, 500, 1100, 1300, 1500],
    },
    { type: "Tax", id: "SuperTax", cost: 100 },
    {
      type: "Estate",
      id: "DarkBlueB",
      category: "DarkBlue",
      purchasePrice: 400,
      rent: [50, 200, 600, 1400, 1700, 2000],
    },
];