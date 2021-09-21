
export class MapInformation
{
    public readonly Width : number;
    public readonly Height : number;
    public readonly Bombs : number;

    constructor(width : number, height : number, bombs : number)
    {
        this.Width = width;
        this.Height = height;
        this.Bombs = bombs;
    }

    public withBombs(bombs : number) : MapInformation
    {
        return new MapInformation(this.Width, this.Height, bombs);
    }

    public toString()
    {
        return `{ Width: ${this.Width}, Height: ${this.Height}, Bombs: ${this.Bombs} }`;
    } 
}
