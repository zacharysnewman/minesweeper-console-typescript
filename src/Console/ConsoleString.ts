import chalk, { Chalk } from "chalk";
import { ForegroundColor, BackgroundColor } from "./Color";

export class ConsoleString {
  public readonly text: string;
  public readonly foregroundColor: ForegroundColor;
  public readonly backgroundColor: BackgroundColor;

  constructor(
    text: string,
    foregroundColor: ForegroundColor,
    backgroundColor: BackgroundColor
  ) {
    this.text = text;
    this.foregroundColor = foregroundColor;
    this.backgroundColor = backgroundColor;
  }

  public toString(): string {
    let fg = chalk[this.foregroundColor];
    let bg = chalk[this.backgroundColor];
    return fg(bg(this.text));
  }

  // public static implicit operator ConsoleString((string, Color, Color) tuple)
  // {
  //     (string text, Color foregroundColor, Color backgroundColor) = tuple;
  //     return new ConsoleString(text, foregroundColor, backgroundColor);
  // }
}
