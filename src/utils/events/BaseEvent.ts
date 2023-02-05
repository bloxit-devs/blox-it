import { QClient } from "../QClient";
import { Collection } from "discord.js";

export class ClientEvent {
    event: QEvent.QClientEvents;
    order: "pre" | "post";

    constructor(options: EventOptions) {
        this.event = options.event;
        this.order = options.order;
    }

    public init(client: QClient) {
        client.events = client.events || new Collection();

        const eventTable = client.events.get(this.event);
        switch (this.order) {
            case "pre":
                if (eventTable?.pre !== undefined)
                    throw `There is already a pre-event hook connected for ${this.event.toString()}`;

                client.events.set(this.event, {
                    pre: this,
                    post: eventTable?.post
                });
                break;
            case "post":
                if (eventTable?.post !== undefined) {
                    const tempArray = eventTable.post;
                    tempArray.push(this);
                    client.events.set(this.event, {
                        pre: eventTable?.pre,
                        post: tempArray
                    });
                    return;
                }

                client.events.set(this.event, {
                    pre: eventTable?.pre,
                    post: [this]
                });
                break;
        }
    }
}

export interface EventOptions {
    event: QEvent.QClientEvents;
    order: "pre" | "post";
}

export namespace QEvent {
    export type EventResult = any | any[];
    export type QClientEvents = `${import("discord.js").Events}`;
    export type QClient = import("../QClient").QClient;
}
