export enum Color {
  None = "whiteBright",
  bgNone = "bgBlackBright",
  black = "black",
  red = "red",
  green = "green",
  yellow = "yellow",
  blue = "blue",
  magenta = "magenta",
  cyan = "cyan",
  white = "white",
  gray = "gray",
  grey = "grey",
  blackBright = "blackBright",
  redBright = "redBright",
  greenBright = "greenBright",
  yellowBright = "yellowBright",
  blueBright = "blueBright",
  magentaBright = "magentaBright",
  cyanBright = "cyanBright",
  whiteBright = "whiteBright",
  bgBlack = "bgBlack",
  bgRed = "bgRed",
  bgGreen = "bgGreen",
  bgYellow = "bgYellow",
  bgBlue = "bgBlue",
  bgMagenta = "bgMagenta",
  bgCyan = "bgCyan",
  bgWhite = "bgWhite",
  bgGray = "bgGray",
  bgGrey = "bgGrey",
  bgBlackBright = "bgBlackBright",
  bgRedBright = "bgRedBright",
  bgGreenBright = "bgGreenBright",
  bgYellowBright = "bgYellowBright",
  bgBlueBright = "bgBlueBright",
  bgMagentaBright = "bgMagentaBright",
  bgCyanBright = "bgCyanBright",
  bgWhiteBright = "bgWhiteBright",
}

/**
Basic foreground colors.

[More colors here.](https://github.com/chalk/chalk/blob/master/readme.md#256-and-truecolor-color-support)
*/

export type ForegroundColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "grey"
  | "blackBright"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright";

/**
Basic background colors.

[More colors here.](https://github.com/chalk/chalk/blob/master/readme.md#256-and-truecolor-color-support)
*/
export type BackgroundColor =
  | "bgBlack"
  | "bgRed"
  | "bgGreen"
  | "bgYellow"
  | "bgBlue"
  | "bgMagenta"
  | "bgCyan"
  | "bgWhite"
  | "bgGray"
  | "bgGrey"
  | "bgBlackBright"
  | "bgRedBright"
  | "bgGreenBright"
  | "bgYellowBright"
  | "bgBlueBright"
  | "bgMagentaBright"
  | "bgCyanBright"
  | "bgWhiteBright";

/**
Basic colors.

[More colors here.](https://github.com/chalk/chalk/blob/master/readme.md#256-and-truecolor-color-support)
*/
// export type Color = ForegroundColor | BackgroundColor;

export type Modifiers =
  | "reset"
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "inverse"
  | "hidden"
  | "strikethrough"
  | "visible";
// /// <summary>Specifies constants that define foreground and background colors for the console.</summary>
// export enum Color {
//   None = -1,
//   /// <summary>The color black.</summary>
//   Black,
//   /// <summary>The color dark blue.</summary>
//   DarkBlue,
//   /// <summary>The color dark green.</summary>
//   DarkGreen,
//   /// <summary>The color dark cyan (dark blue-green).</summary>
//   DarkCyan,
//   /// <summary>The color dark red.</summary>
//   DarkRed,
//   /// <summary>The color dark magenta (dark purplish-red).</summary>
//   DarkMagenta,
//   /// <summary>The color dark yellow (ochre).</summary>
//   DarkYellow,
//   /// <summary>The color gray.</summary>
//   Gray,
//   /// <summary>The color dark gray.</summary>
//   DarkGray,
//   /// <summary>The color blue.</summary>
//   Blue,
//   /// <summary>The color green.</summary>
//   Green,
//   /// <summary>The color cyan (blue-green).</summary>
//   Cyan,
//   /// <summary>The color red.</summary>
//   Red,
//   /// <summary>The color magenta (purplish-red).</summary>
//   Magenta,
//   /// <summary>The color yellow.</summary>
//   Yellow,
//   /// <summary>The color white.</summary>
//   White,
// }
