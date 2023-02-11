import { ContextMenuCommandBuilder, ApplicationCommandType } from "discord.js";
import { getRobloxID } from "../../models/User";
import { Roblox } from "../../modules/Roblox";
import { QInteraction } from "../../utils/QInteraction";

export class contextWhois extends QInteraction {
    public constructor() {
        super(
            new ContextMenuCommandBuilder()
                .setType(ApplicationCommandType.User)
                .setName("Whois Lookup")
                .setDMPermission(false)
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.UserContext) {
        const rID = await getRobloxID(client, interaction.targetId);
        if (!rID)
            return interaction.reply({
                content: "Could not get user's Roblox ID!",
                ephemeral: true
            });

        const user = await Roblox.getUser(rID);
        if (!user)
            return interaction.reply({
                content: "Could not get user's Roblox user data!",
                ephemeral: true
            });

        return interaction.reply({
            embeds: [await Roblox.generateEmbed(user)],
            ephemeral: true
        });
    }
}
