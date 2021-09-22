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
