import { ClientEvent, QEvent } from "./BaseEvent";

export class PostEvent extends ClientEvent {
    public constructor(event: QEvent.QClientEvents) {
        super({
            event: event,
            order: "post"
        });
    }

    public execute?(client: QEvent.QClient, ...args: any[]): QEvent.EventResult;
}
