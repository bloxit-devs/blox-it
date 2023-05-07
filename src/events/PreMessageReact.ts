import { MessageReaction, User } from "discord.js";
import { PreEvent } from "../utils/events/PreEvent";
import { QEvent } from "../utils/events/BaseEvent";

const StarboardEmojis = ["⭐"];

export class PreMessageReact extends PreEvent {
    public constructor() {
        super("messageReactionAdd");
    }

    public execute(client: QEvent.QClient, reaction: MessageReaction, user: User) {
        // Detect Starboard Emoji
        if (
            !(
                (reaction.emoji.name && StarboardEmojis.includes(reaction.emoji.name)) ||
                StarboardEmojis.includes(reaction.emoji.identifier)
            )
        )
            return false;

        // Detect Self Stars
        if (user.id === reaction.message.author?.id) return false;

        // Detect starboard min reaction requirement
        if (reaction.count >= 1) return reaction.message;
    }
}
