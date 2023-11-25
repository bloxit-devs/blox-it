import { ChannelType, PermissionFlagsBits as Perms, SlashCommandBuilder } from "discord.js";
import { QInteraction } from "../utils/QInteraction.js";
import { setNotifyChannels, setNotifyRoles } from "../models/Guild.js";

export class notifier extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("notifier")
                .setDescription("handle the guild notifiers")
                .setDMPermission(false)
                .setDefaultMemberPermissions(Perms.Administrator | Perms.ManageChannels | Perms.ManageGuild)
                .addSubcommandGroup((group) =>
                    group
                        .setName("add")
                        .setDescription("add a notifier option")
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("channel")
                                .setDescription("add a notifier channel")
                                .addStringOption((opt) =>
                                    opt
                                        .setName("type")
                                        .setDescription("the category to listen to")
                                        .addChoices(
                                            { name: "Updates", value: "rbxUpdates" },
                                            { name: "Release Notes", value: "rbxReleases" }
                                        )
                                        .setRequired(true)
                                )
                                .addChannelOption((opt) =>
                                    opt
                                        .setName("channel")
                                        .setDescription("the channel to post to")
                                        .addChannelTypes(ChannelType.GuildNews, ChannelType.GuildText)
                                        .setRequired(true)
                                )
                        )
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("role")
                                .setDescription("add a notifier role")
                                .addStringOption((opt) =>
                                    opt
                                        .setName("type")
                                        .setDescription("the event that pings the role")
                                        .addChoices(
                                            { name: "All", value: "allRole" },
                                            { name: "Roblox Updates", value: "updateRole" },
                                            { name: "Roblox Releases", value: "releaseRole" }
                                        )
                                        .setRequired(true)
                                )
                                .addRoleOption((opt) =>
                                    opt.setName("role").setDescription("the role to ping").setRequired(true)
                                )
                        )
                )
                .addSubcommandGroup((group) =>
                    group
                        .setName("remove")
                        .setDescription("remove a notifier option")
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("channel")
                                .setDescription("remove a notifier channel")
                                .addStringOption((opt) =>
                                    opt
                                        .setName("type")
                                        .setDescription("the category to listen to")
                                        .addChoices(
                                            { name: "Updates", value: "rbxUpdates" },
                                            { name: "Release Notes", value: "rbxReleases" }
                                        )
                                        .setRequired(true)
                                )
                        )
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("role")
                                .setDescription("remove a notifier role")
                                .addStringOption((opt) =>
                                    opt
                                        .setName("type")
                                        .setDescription("the event that pings the role")
                                        .addChoices(
                                            { name: "All", value: "allRole" },
                                            { name: "Roblox Updates", value: "updateRole" },
                                            { name: "Roblox Releases", value: "releaseRole" }
                                        )
                                        .setRequired(true)
                                )
                        )
                )
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const subcommandgroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const type = interaction.options.getString("type");
        const channelID = interaction.options.getChannel("channel")?.id;
        const roleID = interaction.options.getRole("role")?.id;

        // Avoiding no guild
        if (!interaction.guildId) return;
        await interaction.deferReply({ ephemeral: true });

        // Getting the set function
        const updateNotifier: any = subcommand === "channel" ? setNotifyChannels : setNotifyRoles;
        const ID = subcommand === "channel" ? channelID : roleID;
        const result = subcommand === "channel" ? `<#${ID}>` : `<@&${ID}>`;

        // Handling output based on subcommand
        switch (subcommandgroup) {
            case "add":
                updateNotifier(interaction.guildId, type, ID);
                await interaction.editReply(`Successfully added notifier ${subcommand} for **${type}** to ${result}`);
                break;

            case "remove":
                updateNotifier(interaction.guild, type, null);
                await interaction.editReply(`Successfully removed notifier ${subcommand} for **${type}**`);
                break;
        }
    }
}
