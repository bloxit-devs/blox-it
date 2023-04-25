import { SlashCommandBuilder } from "discord.js";
import { getRobloxID } from "../../models/User";
import { Roblox } from "../../modules/Roblox";
import { QInteraction } from "../../utils/QInteraction";

export class whois extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("whois")
                .setDescription("perform a whois lookup on a user or roblox account")
                .setDMPermission(false)
                .addUserOption((opt) => opt.setName("user").setDescription("the user to query"))
                .addNumberOption((opt) => opt.setName("id").setDescription("the roblox id to query"))
                .addStringOption((opt) => opt.setName("username").setDescription("the roblox username to query"))
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const dUser = interaction.options.getUser("user");
        const rID = interaction.options.getNumber("id");
        const rUsername = interaction.options.getString("username");

        // Option constraints
        if (interaction.options.data.length !== 1) {
            return interaction.reply({
                content: "You must only specify one option!",
                ephemeral: true
            });
        }

        // Defer reply as we are accessing potentially slow systems (database)
        interaction.deferReply({ ephemeral: true });

        let user = null;

        // Get from roblox discord user
        if (dUser) {
            const userEntry = await getRobloxID(dUser.id);
            if (!userEntry) return interaction.editReply("Failed to get user's Roblox ID!");

            user = await Roblox.getUser(userEntry);
        }

        // Get from roblox id
        if (rID) user = await Roblox.getUser(rID);

        // Get from roblox username
        if (rUsername) user = await Roblox.getUserByName(rUsername);

        if (!user) {
            return interaction.editReply("Failed to resolve user!");
        }

        return interaction.editReply({
            embeds: [Roblox.generateEmbed(user)]
        });
    }
}
