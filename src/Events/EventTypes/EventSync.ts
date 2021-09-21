type Action = () => void;
type Action1<T> = (t : T) => void;
type Action2<T,U> = (t : T, u : U) => void;
export class EventSync
{
    private subscribers : Set<Action> = new Set<Action>();
    public publish() : void
    {
        for(var subscriber of this.subscribers)
        {
            subscriber();
        }
    }
    public subscribe(at : Action) : void
    {
        if (!this.subscribers.has(at))
        {
            this.subscribers.add(at);
        }
    }
    public unsubscribe(at : Action) : void
    {
        if (this.subscribers.has(at))
        {
            this.subscribers.delete(at);
        }
    }
}
export class EventSync1<T>
{
    private subscribers : Set<Action1<T>> = new Set<Action1<T>>();
    public publish(payload : T) : void
    {
        for(var subscriber of this.subscribers)
        {
            subscriber(payload);
        }
    }
    public subscribe(action : Action1<T>) : void
    {
        if (!this.subscribers.has(action))
        {
            this.subscribers.add(action);
        }
    }
    public unsubscribe(at : Action1<T>) : void
    {
        if (this.subscribers.has(at))
        {
            this.subscribers.delete(at);
        }
    }
}
export class EventSync2<T,U>
{
    private subscribers : Set<Action2<T,U>> = new Set<Action2<T,U>>();
    public publish(tPayload : T, uPayload : U) : void
    {
        for(var subscriber of this.subscribers)
        {
            subscriber(tPayload, uPayload);
        }
    }
    public subscribe(action : Action2<T,U>) : void
    {
        if (!this.subscribers.has(action))
        {
            this.subscribers.add(action);
        }
    }
    public unsubscribe(at : Action2<T,U>) : void
    {
        if (this.subscribers.has(at))
        {
            this.subscribers.delete(at);
        }
    }
}
// public class EventSync<T>
// {
//     public HashSet<Action<T>> subscribers = new HashSet<Action<T>>();
//     public void Publish(T t)
//     {
//         foreach (var subscriber in this.subscribers)
//         {
//             subscriber(t);
//         }
//     }
//     public void Subscribe(Action<T> at)
//     {
//         if (!this.subscribers.Contains(at))
//         {
//             this.subscribers.Add(at);
//         }
//     }
//     public void Unsubscribe(Action<T> at)
//     {
//         if (this.subscribers.Contains(at))
//         {
//             this.subscribers.Remove(at);
//         }
//     }
// }
// public class EventSync<T, U>
// {
//     public HashSet<Action<T, U>> subscribers = new HashSet<Action<T, U>>();
//     public void Publish(T t, U u)
//     {
//         foreach (var subscriber in subscribers)
//         {
//             subscriber(t, u);
//         }
//     }
//     public void Subscribe(Action<T, U> at)
//     {
//         if (!this.subscribers.Contains(at))
//         {
//             this.subscribers.Add(at);
//         }
//     }
//     public void Unsubscribe(Action<T, U> at)
//     {
//         if (this.subscribers.Contains(at))
//         {
//             this.subscribers.Remove(at);
//         }
//     }
// }
// public class EventSync<T, U, V>
// {
//     public HashSet<Action<T, U, V>> subscribers = new HashSet<Action<T, U, V>>();
//     public void Publish(T t, U u, V v)
//     {
//         foreach (var subscriber in subscribers)
//         {
//             subscriber(t, u, v);
//         }
//     }
//     public void Subscribe(Action<T, U, V> at)
//     {
//         if (!this.subscribers.Contains(at))
//         {
//             this.subscribers.Add(at);
//         }
//     }
//     public void Unsubscribe(Action<T, U, V> at)
//     {
//         if (this.subscribers.Contains(at))
//         {
//             this.subscribers.Remove(at);
//         }
//     }
// }
// public class EventSync<T, U, V, W>
// {
//     public HashSet<Action<T, U, V, W>> subscribers = new HashSet<Action<T, U, V, W>>();
//     public void Publish(T t, U u, V v, W w)
//     {
//         foreach (var subscriber in subscribers)
//         {
//             subscriber(t, u, v, w);
//         }
//     }
//     public void Subscribe(Action<T, U, V, W> at)
//     {
//         if (!this.subscribers.Contains(at))
//         {
//             this.subscribers.Add(at);
//         }
//     }
//     public void Unsubscribe(Action<T, U, V, W> at)
//     {
//         if (this.subscribers.Contains(at))
//         {
//             this.subscribers.Remove(at);
//         }
//     }
// }