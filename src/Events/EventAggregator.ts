import { Evt } from "./Events";

export abstract class EventAggregator {
  private static subscribers: Map<string, any> = new Map<string, object>();
  public static get<T>(event: Evt<T>): T {
    const eventType = event.name;
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, event.constructor());
    }
    return this.subscribers.get(eventType) as T;
  }
}

// public static class EventAggregator
// {
//     private static Dictionary<Type, object> subscribers = new Dictionary<Type, object>();
//     public static TEventType Get<TEventType>() where TEventType : new()
//     {
//         var eventType = typeof(TEventType);
//         if (!EventAggregator.subscribers.ContainsKey(eventType))
//         {
//             EventAggregator.subscribers.Add(eventType, new TEventType());
//         }
//         return (TEventType)subscribers[eventType];
//     }
// }
