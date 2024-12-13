import { degToRad } from "three/src/math/MathUtils.js";

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
export const ColourMap: Record<string, number> = {
  "Brown": 0x7e4b27,
  "LightBlue": 0x9fd3ed,
  "Pink": 0xc93182,
  "Orange": 0xe3992d,
  "Red": 0xcf112e,
  "Yellow": 0xebea50,
  "Green": 0x3eab5c,
  "DarkBlue": 0x446aa9,
  "Railroad": 0x000000,
  "Utility": 0xffffff,
}
export function ColourToString(colour: number) {
    return "#" + colour.toString(16).padStart(6, "0");
}


export function calculateXYForSpacePosition(index: number) {
  
  // TODO: Refactor when more complex boards exist
  const side = Math.floor(index / 10);
  const delta = index % 10;

  let xComponent = 0;
  let yComponent = 0;
  switch (side) {
    case 0:
      yComponent = 0;
      xComponent = -1 * delta * 80;
      break;
    case 1:
      xComponent = -800;
      yComponent = delta * 80;
      break;
    case 2:
      yComponent = 800;
      xComponent = -800 + (delta * 80);
      break;
    case 3:
      xComponent = 0;
      yComponent = 800 - (delta * 80);
      break;
  }

  // index 0 = 0,0
  // index 10 = 1000, 0
  // index 20 = 1000, 1000
  // index 30 = 0, 1000
  // index 40 = 0,0
  return [new THREE.Vector3(xComponent, yComponent, 0), new THREE.Euler(0, 0, degToRad(-90 * side))];
}