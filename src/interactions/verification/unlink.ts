import { SlashCommandBuilder } from "discord.js";
import { getGuild } from "../../models/Guild.js";
import { unlinkAccount } from "../../models/User.js";
import { QInteraction } from "../../utils/QInteraction.js";
import { removeRoles } from "./verify.js";

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
        await interaction.deferReply({ ephemeral: true });

        // Get guild from database
        const guild = await getGuild(interaction.guildId!);

        // Verifying if auser and guild are specified
        if (!(user && guild)) {
            return interaction.editReply("Could not unlink your account! Failed to get user or guild.");
        }

        // Attempt to unlink account and remove roles
        if (!((await unlinkAccount(interaction.user.id)) && removeRoles(guild, user))) {
            return interaction.editReply("Failed to unlink or remove your roles!");
        }

        // Remove nickname
        await user.setNickname(null).catch(() => null);

        return interaction.editReply("Successfully unlinked your account!");
    }
}
