import {
    SlashCommandBuilder,
    PermissionFlagsBits as Perms,
    EmbedBuilder,
    Collection,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder as MessageRow,
    TextBasedChannel,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    GuildMember
} from "discord.js";
import { QInteraction } from "../../utils/QInteraction";
import { VerificationSettings, updateVerifySettings, getGuild, Guild } from "../../models/Guild";
import { verifyCode } from "../../models/Code";
import { getRobloxID, linkAccount, unlinkAccount } from "../../models/User";
import { Roblox } from "../../modules/Roblox";

export async function removeRoles(guild: Guild, user: GuildMember): Promise<boolean> {
    try {
        const roles: string[] = [];

        if (guild?.verifiedRole && user.roles.cache.has(guild?.verifiedRole)) roles.push(guild?.verifiedRole);
        if (guild?.devMemberRole && user.roles.cache.has(guild?.devMemberRole)) roles.push(guild?.devMemberRole);
        if (guild?.devRegularRole && user.roles.cache.has(guild?.devRegularRole)) roles.push(guild?.devRegularRole);
        if (guild?.rbxStaffRole && user.roles.cache.has(guild?.rbxStaffRole)) roles.push(guild?.rbxStaffRole);

        await user.roles.remove(roles, "Verification System");
    } catch (err) {
        return false;
    }

    return true;
}

export async function updateAccount(guild: Guild, user: GuildMember): Promise<boolean> {
    const robloxID = await getRobloxID(user.id);
    if (!robloxID) return false;

    const rbx = await Roblox.getUser(robloxID);
    if (!rbx) return false;

    try {
        const roles: string[] = [];

        // If the user owns the server, this will error due to invalid permissions,
        // so we just catch this into null.
        await user?.setNickname(rbx?.username).catch(() => null);

        // TODO: Don't remove them all first, dynamically change them.
        if (!(await removeRoles(guild, user))) return false;

        if (guild?.verifiedRole) roles.push(guild.verifiedRole);
        if (guild?.devMemberRole && rbx?.trustLevel === Roblox.TrustLevel.Member) roles.push(guild.devMemberRole);
        if (guild?.devRegularRole && rbx?.trustLevel === Roblox.TrustLevel.Regular) roles.push(guild.devRegularRole);
        if (guild?.rbxStaffRole && rbx?.isStaff) roles.push(guild.rbxStaffRole);

        await user.roles.add(roles, "Verification System");
    } catch (err) {
        return false;
    }

    return true;
}

export class verify extends QInteraction {
    private embeds: Collection<string, EmbedBuilder> = new Collection();

    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("verify")
                .setDescription("manage account verification")
                .setDMPermission(false)
                .setDefaultMemberPermissions(Perms.Administrator | Perms.ManageChannels | Perms.ManageGuild)
                .addSubcommand((cmd) =>
                    cmd.setName("embed").setDescription("send the main verification embed in the current channel")
                )
                .addSubcommand((cmd) => cmd.setName("enable").setDescription("enable the verification system"))
                .addSubcommand((cmd) =>
                    cmd
                        .setName("disable")
                        .setDescription("disable the verification system")
                        .addStringOption((opt) =>
                            opt.setName("reason").setDescription("the reason for disabling").setRequired(true)
                        )
                )
                .addSubcommandGroup((group) =>
                    group
                        .setName("role")
                        .setDescription("manage verification roles")
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("verified")
                                .setDescription("set the verified role")
                                .addRoleOption((opt) =>
                                    opt.setName("role").setDescription("the verified role").setRequired(true)
                                )
                        )
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("devforum")
                                .setDescription("set the dev forum roles")
                                .addRoleOption((opt) =>
                                    opt.setName("member").setDescription("the dev forum member role").setRequired(true)
                                )
                                .addRoleOption((opt) =>
                                    opt.setName("regular").setDescription("the dev forum regular role").setRequired(true)
                                )
                        )
                        .addSubcommand((cmd) =>
                            cmd
                                .setName("rbxstaff")
                                .setDescription("set the Roblox staff role")
                                .addRoleOption((opt) =>
                                    opt.setName("role").setDescription("the Roblox staff role").setRequired(true)
                                )
                        )
                )
                .addSubcommand((cmd) =>
                    cmd
                        .setName("forceupdate")
                        .setDescription("force update a user")
                        .addUserOption((opt) => opt.setName("user").setDescription("user to force update").setRequired(true))
                )
                .addSubcommand((cmd) =>
                    cmd
                        .setName("forcelink")
                        .setDescription("force link a user")
                        .addUserOption((opt) => opt.setName("user").setDescription("user to link").setRequired(true))
                        .addNumberOption((opt) =>
                            opt.setName("robloxid").setDescription("roblox id of the user to link").setRequired(true)
                        )
                )
                .addSubcommand((cmd) =>
                    cmd
                        .setName("forceunlink")
                        .setDescription("force unlink a user")
                        .addUserOption((opt) => opt.setName("user").setDescription("user to unlink").setRequired(true))
                )
        );

        // Main Verification Embed
        this.embeds.set(
            "init",
            new EmbedBuilder()
                .setTitle("Welcome to Blox-it")
                .setDescription(
                    "This server is protected with Roblox Verification.\n\nTo link your Roblox and Discord account, carefully follow the instructions below.\n*We only store your Roblox and Discord ID. We **will not** ask for any personal information.*\n\nEnsure you have read <#879186171857612801> before accessing the server."
                )
                .setFields({
                    name: "Verification Instructions",
                    value: "You can verify your account by joining a game to get a code and then enter it here on Discord.\n\nTo start this process, click the `Verify` button below."
                })
                .setColor(0x545fa9)
        );

        // Disabled Embed
        this.embeds.set("disabled", new EmbedBuilder().setTitle("Welcome to Blox-it").setColor(0xea171a));

        // Game Verification Embed
        this.embeds.set(
            "game",
            new EmbedBuilder()
                .setTitle("Account Verification")
                .setDescription(
                    "To verify your account follow the steps below." //\n\nIf you wish to change to Profile Verification, you can do this by dismissing this message and pressing the `Profile` button on the original embed."
                )
                .setFields(
                    { name: "Step 1", value: "Join the game using the `Game Link` button below." },
                    { name: "Step 2", value: "Press the generate button and copy the code." },
                    { name: "Step 3", value: "Press the `Submit Code` button below and enter the code." },
                    { name: "Step 4", value: "You should be successfully verified!" }
                )
                .setColor(0x545fa9)
        );

        // Profile Verification Embed
        this.embeds.set(
            "profile",
            new EmbedBuilder()
                .setTitle("Account Verification - Profile")
                .setDescription(
                    "To verify your account follow the steps below.\n\nIf you wish to change to Game Verification, you can do this by dismissing this message and pressing the `Game` button on the original embed."
                )
                .setFields(
                    {
                        name: "Step 1",
                        value: "Copy or remember the list of words below, these have to be in exact order! For mobile users, these have been put in the message content."
                    },
                    {
                        name: "Step 2",
                        value: "Navigate to your profile on Roblox and add the list of words to your about section."
                    },
                    { name: "Step 3", value: "Press the `Check Profile` button below and enter your Roblox username." },
                    { name: "Step 4", value: "You should be successfully verified!" }
                )
                .setColor(0x545fa9)
        );

        // Code Modal
        this.addTextInput(
            new TextInputBuilder()
                .setCustomId("code")
                .setLabel("Please enter the code you generated below:")
                .setStyle(TextInputStyle.Short)
                .setMaxLength(6)
                .setMinLength(6)
                .setRequired()
                .setPlaceholder("123456"),
            "code"
        );

        this.addModal(
            new ModalBuilder()
                .setCustomId("submitGame")
                .setTitle("Enter Verification Code")
                .addComponents(this.getRows("code")),
            async (interaction: QInteraction.ModalSubmit) => {
                const rawCode = interaction.fields.getTextInputValue("code");

                if (rawCode.match(/^[0-9]{1,6}$/)) {
                    interaction.deferReply({ ephemeral: true });
                    const [success, result] = await verifyCode(parseInt(rawCode));

                    if (!success) {
                        return interaction.editReply(result as string);
                    }

                    if (await linkAccount(interaction.user.id, result as number)) {
                        const rbx = await Roblox.getUser(result as number);
                        if (!rbx) {
                            await unlinkAccount(interaction.user.id);
                            return interaction.editReply("Could not verify! Please try again!");
                        }

                        const user = interaction.guild?.members.cache.get(interaction.user.id);
                        const guild = await getGuild(interaction.guildId!);

                        if (!(guild && user && (await updateAccount(guild, user)))) {
                            await unlinkAccount(interaction.user.id);
                            return interaction.editReply("Failed to link account! Please try again!");
                        }

                        return interaction.editReply("Successfully linked account!");
                    } else {
                        return interaction.reply("Failed to link account! Please contact a mod!");
                    }
                } else {
                    return interaction.reply({
                        content: "Invalid code!",
                        ephemeral: true
                    });
                }
            }
        );

        // Profile Modal
        this.addTextInput(
            new TextInputBuilder()
                .setCustomId("username")
                .setLabel("Please enter your username:")
                .setStyle(TextInputStyle.Short)
                .setMinLength(3)
                .setMaxLength(20)
                .setRequired()
                .setPlaceholder("BigBoyTommyFlabby"),
            "username"
        );

        this.addModal(
            new ModalBuilder()
                .setCustomId("submitProfile")
                .setTitle("Enter Your Username")
                .addComponents(this.getRows("username")),
            async (interaction: QInteraction.ModalSubmit) => {
                const user = await Roblox.getUserByName(interaction.fields.getTextInputValue("username"));
                if (!user)
                    return interaction.reply({
                        content: "Invalid username!",
                        ephemeral: true
                    });

                return interaction.reply({
                    content: "This is currently not implemented!",
                    ephemeral: true
                });
            }
        );

        // Main Verification Buttons
        this.addButton(
            new ButtonBuilder().setCustomId("gameButton").setLabel("Verify").setStyle(ButtonStyle.Primary),
            "init",
            (interaction: QInteraction.Button) => {
                return interaction.reply({
                    embeds: [this.embeds.get("game")!],
                    components: this.getRows<MessageRow>("game"),
                    ephemeral: true
                });
            }
        );

        this.addButton(
            new ButtonBuilder().setCustomId("profileButton").setLabel("Profile").setStyle(ButtonStyle.Secondary),
            "init_2",
            (interaction: QInteraction.Button) => {
                return interaction.reply({
                    embeds: [this.embeds.get("profile")!],
                    components: this.getRows<MessageRow>("profile"),
                    ephemeral: true
                });
            }
        );

        // Game Verification Buttons
        this.addButton(
            new ButtonBuilder().setCustomId("submitCode").setLabel("Submit Code").setStyle(ButtonStyle.Primary),
            "game",
            (interaction: QInteraction.Button) => {
                return interaction.showModal(this.getModal("submitGame")!);
            }
        );

        this.addButton(
            new ButtonBuilder()
                .setLabel("Game Link")
                .setStyle(ButtonStyle.Link)
                .setURL("https://www.roblox.com/games/7964576823/Blox-it-Verification"),
            "game"
        );

        // Profile Verification Buttons
        this.addButton(
            new ButtonBuilder().setCustomId("submitUsername").setLabel("Check Profile").setStyle(ButtonStyle.Primary),
            "profile",
            (interaction: QInteraction.Button) => {
                return interaction.showModal(this.getModal("submitProfile")!);
            }
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const data: VerificationSettings = {};
        let message = "";

        // Avoiding no guild, it's probably not needed, but it's good to have.
        if (!interaction.guildId) return;
        interaction.deferReply({ ephemeral: true });

        switch (subcommandGroup) {
            case "role": {
                switch (subcommand) {
                    case "verified":
                        data.verifiedRole = interaction.options.getRole("role")?.id;

                        message = "Successfuly updated the verified role!";
                        break;
                    case "devforum":
                        data.devMemberRole = interaction.options.getRole("member")?.id;
                        data.devRegularRole = interaction.options.getRole("regular")?.id;

                        message = "Successfully updated the dev forum member and regular roles!";
                        break;
                    case "rbxstaff":
                        data.rbxStaffRole = interaction.options.getRole("role")?.id;

                        message = "Successfully updated the Roblox staff role!";
                        break;
                }
                break;
            }
            default: {
                switch (subcommand) {
                    case "embed": {
                        const guild = await getGuild(interaction.guildId);

                        if (!guild) {
                            message = "Could not get guild data!";
                            break;
                        }
                        if (guild.verifyEmbedID) {
                            message =
                                "An embed already exists, the old one(s) will no longer be updated when the system is enabled/disabled!\n\n";
                        }

                        await interaction.channel
                            ?.send({
                                embeds: [this.embeds.get("init")!],
                                components: this.getRows<MessageRow>("init")
                            })
                            .then((msg) => {
                                data.verifyEmbedID = `${msg.channelId}|${msg.id}`;
                                message += "Successfully sent the embed!";
                            })
                            .catch(() => {
                                message += "Failed to send embed! Make sure I can send messages in this channel!";
                            });
                        break;
                    }
                    case "enable": {
                        const guild = await getGuild(interaction.guildId);

                        if (!guild?.verifiedRole) {
                            message = "You need to set a verified role to enable the verification system!";
                            break;
                        }

                        if (guild?.verifyEmbedID) {
                            const [channelID, msgID] = guild.verifyEmbedID.split("|");
                            const channel = (await interaction.guild?.channels
                                .fetch(channelID)
                                .catch(() => null)) as TextBasedChannel;
                            if (channel) {
                                const msg = await channel.messages.fetch(msgID).catch(() => null);
                                if (msg) {
                                    msg.edit({
                                        embeds: [this.embeds.get("init")!],
                                        components: this.getRows<MessageRow>("init")
                                    }).catch(
                                        () => (message = "Could not edit original embed, does the bot have permission?\n\n")
                                    );
                                } else {
                                    message =
                                        "Could not edit original message. To enable it, run the embed command in the channel and delete old message!\n\n";
                                }
                            } else {
                                message =
                                    "Could not edit original message. To enable it, run the embed command in the channel and delete old message!\n\n";
                            }
                        }

                        data.verifyEnabled = true;

                        message += "Successfully enabled the verification system!";
                        break;
                    }
                    case "disable": {
                        const guild = await getGuild(interaction.guildId);

                        if (guild?.verifyEmbedID) {
                            const [channelID, msgID] = guild.verifyEmbedID.split("|");
                            const channel = (await interaction.guild?.channels
                                .fetch(channelID)
                                .catch(() => null)) as TextBasedChannel;
                            if (channel) {
                                const msg = await channel.messages.fetch(msgID).catch(() => null);
                                const reason = interaction.options.getString("reason");

                                if (msg) {
                                    msg.edit({
                                        embeds: [
                                            this.embeds
                                                .get("disabled")!
                                                .setDescription(`The verification system has been disabled: ${reason}`)
                                        ],
                                        components: []
                                    }).catch(
                                        () => (message = "Could not edit original embed, does the bot have permission?\n\n")
                                    );
                                } else {
                                    message = "Could not edit original embed, was it deleted?\n\n";
                                }
                            } else {
                                message = "Could not edit original embed, was it deleted?\n\n";
                            }
                        }

                        data.verifyEnabled = false;

                        message += "Successfully disabled the verification system!";
                        break;
                    }
                    case "forceupdate": {
                        const user = interaction.guild?.members.cache.get(interaction.options.getUser("user", true).id);
                        const guild = await getGuild(interaction.guildId);

                        if (!guild || !user) {
                            message = "Could not get user or guild!";
                            break;
                        }

                        if (!(await updateAccount(guild, user))) {
                            message = "Could not update user!";
                            break;
                        }

                        message = "Successfully updated user!";
                        break;
                    }
                    case "forcelink": {
                        const user = interaction.options.getUser("user", true);
                        const robloxID = interaction.options.getNumber("robloxid", true);

                        if (!(await linkAccount(user.id, robloxID))) {
                            message = "Could not link user!";
                            break;
                        }

                        message = "Successfully linked user! Don't forget to run forceupdate!";
                        break;
                    }
                    case "forceunlink": {
                        const user = interaction.guild?.members.cache.get(interaction.options.getUser("user", true).id);
                        const guild = await getGuild(interaction.guildId);

                        if (!guild || !user) {
                            message = "Could not get user or guild!";
                            break;
                        }

                        if (!((await removeRoles(guild, user)) && (await unlinkAccount(user.id)))) {
                            message = "Could not unlink user!";
                            break;
                        }

                        await user.setNickname(null).catch(() => null);

                        message = "Successfully unlinked user!";
                        break;
                    }
                }
            }
        }

        if (Object.keys(data).length !== 0 && !(await updateVerifySettings(interaction.guildId, data))) {
            message = "Could not update settings, an error occured!";
        }

        return interaction.editReply(message);
    }
}
