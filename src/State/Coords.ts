export class Coords {
  public readonly x: number = 0;
  public readonly y: number = 0;

  constructor(x?: number, y?: number) {
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
  }

  public toString(): string {
    return `(${this.x},${this.y})`;
  }

  public static zero: Coords = new Coords(0, 0);

  public equals(other: Coords): Boolean {
    return this.x === other.x && this.y === other.y;
  }
  // public override bool Equals(object obj) => this.Equals((Coords)obj);
  // public override int GetHashCode() => base.GetHashCode();

  // public static bool operator ==(Coords a, Coords b) => a.Equals(b);
  // public static bool operator !==(Coords a, Coords b) => !a.Equals(b);

  // public static implicit operator Coords((int, int) t) => new Coords(t.Item1, t.Item2);
}
