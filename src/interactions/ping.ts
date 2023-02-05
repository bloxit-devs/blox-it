import { SlashCommandBuilder } from "discord.js";
import { QInteraction } from "../utils/QInteraction";

export class ping extends QInteraction {
    public constructor() {
        super(new SlashCommandBuilder().setName("ping").setDescription("ping the bot for a response"));
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        await interaction.reply({
            content: "Pong!",
            ephemeral: true
        });
    }
}
