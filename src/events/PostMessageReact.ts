import { MessageReaction, User } from "discord.js";
import { PostEvent } from "../utils/events/PostEvent";
import { QEvent } from "../utils/events/BaseEvent";

export class PostMessageReact extends PostEvent {
    public constructor() {
        super("messageReactionAdd");
    }

    public execute(client: QEvent.QClient, reaction: MessageReaction, reactor: User) {
        console.log("TODO: Handle Emoji");
    }
}
