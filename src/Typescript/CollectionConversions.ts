import { Coords } from "./../State/Coords";
import { Tile } from "./../State/Tile";

// export const tileArrayToTileMap = (tileArray: Tile[]): Tile[] => {
//   // let x = JSON.stringify(Object.entries(tileArray));
//   // console.log("TileArray: ", JSON.stringify(x));
//   // console.log(JSON.stringify(new Tile[](x)));
//   // const kvps = tileArray.map((tile) => [tile.coords, tile] as [Coords, Tile]);
//   // console.log(
//   //   "KVP Array: ",
//   //   JSON.stringify(new Tile[](kvps).values)
//   // );
//   const iAmAMap = new Map( // Look Ma!  No type annotations
//     tileArray.map((x) => [x.coords, x] as [Coords, Tile])
//   );
//   // console.log(iAmAMap);

//   return iAmAMap;
// };
// export const tileMapToTileArray = (tileMap: Tile[]): Tile[] => {
//   return Array.from(tileMap, ([name, value]) => ({ name, value })).map(
//     (x) => x.value
//   );
// };

// export const compareMaps = <T, U>(
//   map1: Map<T, U>,
//   map2: Map<T, U>
// ): Boolean => {
//   var testVal;
//   if (map1.size !== map2.size) {
//     return false;
//   }
//   for (var [key, val] of map1) {

//     testVal = map2.get(key);
//     // in cases of an undefined value, make sure the key
//     // actually exists on the object so there are no false positives
//     if (testVal !== val || (testVal === undefined && !map2.has(key))) {
//       return false;
//     }
//   }
//   return true;
// };
