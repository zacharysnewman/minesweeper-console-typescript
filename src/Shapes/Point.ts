// Screen coordinates: x runs right and y runs down. Its own module so that
// geometry and Tiling can both use it without importing each other.
export interface Point {
  readonly x: number;
  readonly y: number;
}
