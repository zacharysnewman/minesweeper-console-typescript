export class TileGridInformation {
  public readonly Width: number;
  public readonly Height: number;
  public readonly Bombs: number;

  constructor(width?: number, height?: number, bombs?: number) {
    this.Width = width === undefined ? 0 : width;
    this.Height = height === undefined ? 0 : height;
    this.Bombs = bombs === undefined ? 0 : bombs;
  }

  public withBombs(bombs: number): TileGridInformation {
    return new TileGridInformation(this.Width, this.Height, bombs);
  }

  public toString() {
    return `{ Width: ${this.Width}, Height: ${this.Height}, Bombs: ${this.Bombs} }`;
  }

  public equals(other: TileGridInformation) {
    return (
      this.Width === other.Width &&
      this.Height === other.Height &&
      this.Bombs === other.Bombs
    );
  }
}
