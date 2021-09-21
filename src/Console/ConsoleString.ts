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

  public write(): void {
    // let prevForegroundColor = chalk.ForegroundColor;
    // var prevBackgroundColor = chalk.BackgroundColor;

    // if (this.foregroundColor !== Color.None)
    //     Console.ForegroundColor = (ConsoleColor)(int)this.foregroundColor;
    // if (this.backgroundColor !== Color.None)
    //     Console.BackgroundColor = (ConsoleColor)(int)this.backgroundColor;

    // let chalky : () => (str: string) => string =
    let fg = chalk[this.foregroundColor];
    let bg = chalk[this.backgroundColor];
    console.log(fg(bg("message")));

    // Console.ForegroundColor = prevForegroundColor;
    // Console.BackgroundColor = prevBackgroundColor;
  }

  // public static implicit operator ConsoleString((string, Color, Color) tuple)
  // {
  //     (string text, Color foregroundColor, Color backgroundColor) = tuple;
  //     return new ConsoleString(text, foregroundColor, backgroundColor);
  // }
}
