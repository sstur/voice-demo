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

export const eventLogger = new EventLogger();
