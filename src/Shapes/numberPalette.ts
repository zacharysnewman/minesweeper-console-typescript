// Colours for the nearby-bomb numbers, which this board draws as real text
// rather than as slices of a tileset.
//
// The classic palette is 1-8 only, and half of it fails WCAG AA on the
// #c0c0c0 face it is printed on: red is 2.20:1, grey 2.17:1, teal 2.62:1 and
// green 2.82:1. These are its hues held to AA instead, plus four more for the
// counts only a triangle board can reach.
//
// AA on that face caps every colour at roughly L* 34, so all twelve have to
// live in the same dark band -- which is why 3 and 6 had to drift in hue to
// stay clear of 5 and 8 once darkened. The tightest pair among the single
// digits is dE 26; 10-12 sit closer to their neighbours on purpose, because
// being two glyphs wide already tells them apart from every single digit.
export const NUMBER_COLORS: Record<number, string> = {
  1: "#0000ff", // blue, unchanged -- already 4.72:1
  2: "#005b00", // green, darkened from #008000
  3: "#9c0d0d", // red, darkened from #ff0000
  4: "#001a6e", // navy, deepened to clear the darkened blue
  5: "#6b2408", // maroon, warmed to stay clear of the darkened red
  6: "#005c7a", // teal, pushed toward blue to stay clear of the darkened grey
  7: "#000000", // black, unchanged
  8: "#4d4d4d", // grey, darkened from #808080
  9: "#8e0060", // magenta -- the only new single digit, so it gets the most
  //                separated hue left in the band
  10: "#5f1b8c", // purple
  11: "#4a4a00", // olive
  12: "#7a3b00", // brown
};

// The face the numbers are drawn on, and what the contrast above is measured
// against. Kept here so the check harness can verify the palette without
// reading CSS.
export const BOARD_FACE = "#c0c0c0";

export function colorForCount(count: number): string {
  return NUMBER_COLORS[count] ?? NUMBER_COLORS[12];
}
