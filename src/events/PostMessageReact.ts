import { EmbedBuilder, MessageReaction, User } from "discord.js";
import { PostEvent } from "../utils/events/PostEvent";
import { QEvent } from "../utils/events/BaseEvent";

export class PostMessageReact extends PostEvent {
    public constructor() {
        super("messageReactionAdd");
    }

    public execute(client: QEvent.QClient, reaction: MessageReaction, reactor: User) {
        const reactionCount = reaction.count;
        const message = reaction.message;

        // Delete self starrers
        if (reactor === message.author) {
            return message.delete();
        }

        if (reactionCount >= 2 && message.author) {
            const starboardEmbed = new EmbedBuilder()
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.avatarURL() || ""
                })
                .setDescription(message.content);
            message.channel.send({ embeds: [starboardEmbed] });
        }
    }
}
