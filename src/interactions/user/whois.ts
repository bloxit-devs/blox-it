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

        if (interaction.options.data.length !== 1) {
            return interaction.reply({
                content: "You must only specify one option!",
                ephemeral: true
            });
        }

        let user = null;
        if (dUser) {
            const userEntry = await getRobloxID(dUser.id);
            if (!userEntry)
                return interaction.reply({
                    content: "Failed to get user's Roblox ID!",
                    ephemeral: true
                });

            user = await Roblox.getUser(userEntry);
        }

        if (rID) user = await Roblox.getUser(rID);

        if (rUsername) user = await Roblox.getUserByName(rUsername);

        if (!user) {
            return interaction.reply({
                content: "Failed to resolve user!",
                ephemeral: true
            });
        }

        return interaction.reply({
            embeds: [Roblox.generateEmbed(user)],
            ephemeral: true
        });
    }
}
