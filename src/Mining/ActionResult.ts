// What the player's last input did. Lives in its own module so PlayerState can
// carry it without importing the movement rules that produce it.
export enum ActionResult {
  none,
  // Stepped into open cave.
  moved,
  // Rock in the way, so a dig was sent to the game layer instead of a step.
  dug,
  // Flagged or unflagged the tile ahead.
  marked,
  // Bedrock, marked rock, or nothing to mark: the player did not move.
  blocked,
}
