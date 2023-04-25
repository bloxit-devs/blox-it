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
        interaction.deferReply({ ephemeral: true });

        // Get guild from database
        const guild = await getGuild(interaction.guildId!);

        // Verifying if auser and guild are specified
        if (!(user && guild)) {
            return interaction.editReply("Could not update your username and roles! Failed to get user or guild.");
        }

        // Attempt to update account
        if (!(await updateAccount(guild, user))) {
            return interaction.editReply("Failed to update your username and roles! (Are you verified?)");
        }

        return interaction.editReply("Successfully updated your username and roles!");
    }
}
