export type PurchasableTiles = string;
export type PlayerID = number;
export type TeamID = number;
export type Tiles = string;
export type PricedTiles = string;
export type Deck = "Chance"|"CommunityChest";

export const PlayerColors = [
  0xff0303, // Red
  0x0042ff, // Blue
  0x1be7ba, // Teal
  0x550081, // Purple
  0xfefc00, // Yellow
  0xfe890d, // Orange
  0x21bf00, // Green
  0xe45caf, // Pink
  0x939596, // Gray
  0x7ebff1, // Light Blue
  0x106247, // Dark Green
  0x4f2b05, // Brown
  0x9c0000, // Maroon
  0x0000c3, // Navy
  0x00ebff, // Turquois
  0xbd00ff, // Violet
  0xecce87, // Wheat
  0xf7a58b, // Peach
  0xbfff81, // Mint
  0xdbb8eb, // Lavender
  0x4f5055, // Coal
  0xecf0ff, // Snow
  0x00781e, // Emerald
  0xa56f34, // Peanut
  0x2e2d2e, // Black
]
export function ColourToString(colour: number) {
    return "#" + colour.toString(16).padStart(6, "0");
}