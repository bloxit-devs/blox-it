import { MessageReaction, User } from "discord.js";
import { PreEvent } from "../utils/events/PreEvent";
import { QEvent } from "../utils/events/BaseEvent";

export class PreMessageReact extends PreEvent {
    public constructor() {
        super("messageReactionAdd");
    }

    public execute(client: QEvent.QClient, reaction: MessageReaction, reactor: User) {
        if (reaction.emoji.name !== "⭐") {
            return;
        }

        return [reaction, reactor];
    }
}
