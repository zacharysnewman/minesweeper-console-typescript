import { CommandType } from "./Console/CommandType";
import { Renderer } from "./Console/Renderer";
import { EventAggregator } from "./Events/EventAggregator";
import { ActivateTileEvent, GenerateMapEvent } from "./Events/Events";
import { MapInformation } from "./MapGeneration/MapInformation";
import { Coords } from "./State/Coords";
import { Game } from "./State/Game";
import * as Readline from "readline";
import { mainModule } from "process";
const readline = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class App {
  private static mapInfo: MapInformation = new MapInformation(10, 10, 10);
  public static isRunning: Boolean = true;

  public static main(): void {
    Game.init();
    Renderer.init();

    EventAggregator.get(GenerateMapEvent).publish(App.mapInfo);

    while (App.isRunning) {
      readline.question("", (rawInput) => {
        const [command, matches] = App.interpretRawCommand(rawInput);
        App.executeCommand(command, matches);
      });
    }
  }

  private static executeCommand(
    command: CommandType,
    matches: RegExpMatchArray | null
  ): void {
    let rows: string[] = [..."abcdefghijklmnopqrstuvwxyz"];

    switch (command) {
      case CommandType.New:
        console.log("Generating new map...");
        EventAggregator.get(GenerateMapEvent).publish(App.mapInfo);
        break;
      case CommandType.NewWithParams:
        let rawBombs: number = parseInt(
          (matches as RegExpMatchArray)[1].toLowerCase(),
          10
        );
        let bombs: number = rawBombs < 1 ? 1 : rawBombs > 99 ? 99 : rawBombs;
        App.mapInfo = App.mapInfo.withBombs(bombs);
        console.log(`Generating new map with ${bombs} bombs...`);
        EventAggregator.get(GenerateMapEvent).publish(App.mapInfo);
        break;
      case CommandType.FlagWithParams:
        let flagRow: number = rows.indexOf(
          (matches as RegExpMatchArray)[1].toLowerCase()
        );
        let flagCol: number = parseInt(
          (matches as RegExpMatchArray)[2].toLowerCase(),
          10
        );
        console.log("Flagging coordinates or checking nearby tiles...");
        EventAggregator.get(ActivateTileEvent).publish(
          new Coords(flagRow, flagCol),
          true
        );
        break;
      case CommandType.CheckCoords:
        let activateRow: number = rows.indexOf(
          (matches as RegExpMatchArray)[1].toLowerCase()
        );
        let activateCol: number = parseInt(
          (matches as RegExpMatchArray)[2].toLowerCase(),
          10
        );
        console.log("Checking coordinates and nearby tiles...");
        EventAggregator.get(ActivateTileEvent).publish(
          new Coords(activateRow, activateCol),
          false
        );
        break;
      case CommandType.None:
        console.log("Invalid Command! Try again.");
        break;
    }
  }
  private static interpretRawCommand(
    rawCommand: string
  ): [command: CommandType, matches: RegExpMatchArray | null] {
    if (App.NewWithParamsRegex.test(rawCommand)) {
      return [
        CommandType.NewWithParams,
        rawCommand.match(App.NewWithParamsRegex),
      ];
    } else if (App.FlagSimpleWithParamsRegex.test(rawCommand)) {
      return [
        CommandType.FlagWithParams,
        rawCommand.match(App.FlagSimpleWithParamsRegex),
      ];
    } else if (App.FlagWithParamsRegex.test(rawCommand)) {
      return [
        CommandType.FlagWithParams,
        rawCommand.match(App.FlagWithParamsRegex),
      ];
    } else if (App.NewRegex.test(rawCommand)) {
      return [CommandType.New, null];
    } else if (App.CheckSimpleWithParamsRegex.test(rawCommand)) {
      return [
        CommandType.CheckCoords,
        rawCommand.match(App.CheckSimpleWithParamsRegex),
      ];
    } else if (App.CheckWithParamsRegex.test(rawCommand)) {
      return [
        CommandType.CheckCoords,
        rawCommand.match(App.CheckWithParamsRegex),
      ];
    } else {
      return [CommandType.None, null];
    }
  }

  private static NewRegex: RegExp = new RegExp(/new/);
  private static NewWithParamsRegex: RegExp = RegExp(/new ([0-9]+)/);
  private static FlagWithParamsRegex: RegExp = new RegExp(
    /flag ([a-zA-Z])([0-9]+)/
  );
  private static FlagSimpleWithParamsRegex: RegExp = new RegExp(
    /f ([a-zA-Z])([0-9]+)/
  );
  private static CheckWithParamsRegex: RegExp = new RegExp(
    /check ([a-zA-Z])([0-9]+)/
  );
  private static CheckSimpleWithParamsRegex: RegExp = new RegExp(
    /([a-zA-Z])([0-9]+)/
  );
}

App.main();
