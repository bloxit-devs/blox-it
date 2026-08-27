import { Message } from "discord.js";
import { PostEvent } from "../utils/events/PostEvent";
import { QEvent } from "../utils/events/BaseEvent";

export class PostMessageReact extends PostEvent {
    public constructor() {
        super("messageReactionAdd");
    }

    public execute(client: QEvent.QClient, message: Message) {
        console.log(`Star this message ${message.content}`);
        return;
    }
}
