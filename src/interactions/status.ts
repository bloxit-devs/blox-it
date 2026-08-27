import { ChannelType, PermissionFlagsBits as Perms, SlashCommandBuilder } from "discord.js";
import { QInteraction } from "../utils/QInteraction";
import { setStatusChannel } from "../models/Guild";

export class status extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("status")
                .setDescription("handle the guild notifiers")
                .setDMPermission(false)
                .setDefaultMemberPermissions(Perms.Administrator | Perms.ManageChannels | Perms.ManageGuild)
                .addSubcommand((cmd) =>
                    cmd
                        .setName("channel")
                        .setDescription("sets the status feed channel")
                        .addChannelOption((opt) =>
                            opt
                                .setName("channel")
                                .setDescription("the channel to post to")
                                .addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const subcommand = interaction.options.getSubcommand();
        const channelID = interaction.options.getChannel("channel")?.id;

        // Avoiding no guild
        if (!interaction.guildId) return;
        if (!channelID) return;

        switch (subcommand) {
            case "channel":
                await interaction.deferReply({ ephemeral: true });
                setStatusChannel(interaction.guildId, channelID)
                    .then(() => {
                        interaction.editReply(`Successfully set status feed channel.`);
                    })
                    .catch(() => {
                        interaction.editReply(`Failed to set status feed channel.`);
                    });
                break;
        }
    }
}
