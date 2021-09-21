
export abstract class Shuffler
{
    static shuffle<T>(arr : T[]) : T[]
    {
        let i = 0;
        let res : T[] = []
        let index = 0;
      
        while (i <= arr.length - 1) {
          index = Math.floor(Math.random() * arr.length)
      
          if (!res.includes(arr[index])) {
            res.push(arr[index])
            i++
          }
        }
      
        return res;
      }
}
