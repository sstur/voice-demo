import { logger } from './Logger';

type Event = {
  name: string;
  time: number;
};

export class EventLogger {
  private events: Array<Event> = [];

  event(name: string) {
    this.events.push({
      name,
      time: Date.now(),
    });
  }

  getTimeSinceLast(name: string) {
    const now = Date.now();
    const lastEvent = findLast(this.events, (event) => event.name === name);
    return lastEvent ? now - lastEvent.time : 0;
  }

  logTimeSince(name: string, description?: string) {
    const timeElapsed = this.getTimeSinceLast(name);
    const prefix = description ?? `>> Time since ${name}:`;
    logger.log(prefix, timeElapsed);
  }

  dumpEventsRelative() {
    let prevEvent: Event | undefined;
    for (const event of this.events) {
      const timeElapsed = prevEvent ? event.time - prevEvent.time : 0;
      logger.log(`>> ${event.name}: ${timeElapsed}`);
      prevEvent = event;
    }
    this.events.length = 0;
  }
}

function findLast<T>(array: Array<T>, fn: (item: T) => boolean): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i];
    if (item && fn(item)) {
      return item;
    }
  }
}

export const eventLogger = new EventLogger();
