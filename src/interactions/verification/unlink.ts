import { SlashCommandBuilder } from "discord.js";
import { getGuild } from "../../models/Guild";
import { unlinkAccount } from "../../models/User";
import { QInteraction } from "../../utils/QInteraction";
import { removeRoles } from "./verify";

export class unlink extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("unlink")
                .setDescription("unlink your account with Blox-it")
                .setDMPermission(false)
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const user = interaction.guild?.members.cache.get(interaction.user.id);
        const guild = await getGuild(interaction.guildId!);

        if (!(user && guild)) {
            return interaction.reply({
                content: "Could not unlink your account! Failed to get user or guild.",
                ephemeral: true
            });
        }

        if (!((await unlinkAccount(interaction.user.id)) && removeRoles(guild, user))) {
            return interaction.reply({
                content: "Failed to unlink or remove your roles!",
                ephemeral: true
            });
        }

        await user.setNickname(null).catch(() => null);

        return interaction.reply({
            content: "Successfully unlinked your account!",
            ephemeral: true
        });
    }
}
