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
        interaction.deferReply({ ephemeral: true });

        // Find Roblox ID
        const rID = await getRobloxID(interaction.targetId);
        if (!rID) return interaction.editReply("Could not get user's Roblox ID!");

        // Get User from Database
        const user = await Roblox.getUser(rID);
        if (!user) return interaction.editReply("Could not get user's Roblox user data!");

        return interaction.editReply({
            embeds: [await Roblox.generateEmbed(user)]
        });
    }
}
