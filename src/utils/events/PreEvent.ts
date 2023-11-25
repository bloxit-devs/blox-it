import { ClientEvent, QEvent } from "./BaseEvent.js";

export class PreEvent extends ClientEvent {
    public constructor(event: QEvent.QClientEvents) {
        super({
            event: event,
            order: "pre"
        });
    }

    public execute?(client: QEvent.QClient, ...args: any[]): QEvent.EventResult;
}
