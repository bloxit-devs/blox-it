import { SlashCommandBuilder } from "discord.js";
import { getGuild } from "../../models/Guild";
import { QInteraction } from "../../utils/QInteraction";
import { updateAccount } from "./verify";

export class update extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("update")
                .setDescription("update your username and roles from Roblox")
                .setDMPermission(false)
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const user = interaction.guild?.members.cache.get(interaction.user.id);
        const guild = await getGuild(client, interaction.guildId!);

        if (!(user && guild)) {
            return interaction.reply({
                content: "Could not update your username and roles! Failed to get user or guild.",
                ephemeral: true
            });
        }

        if (!(await updateAccount(client, guild, user))) {
            return interaction.reply({
                content: "Failed to update your username and roles! (Are you verified?)",
                ephemeral: true
            });
        }

        return interaction.reply({
            content: "Successfully updated your username and roles!",
            ephemeral: true
        });
    }
}
