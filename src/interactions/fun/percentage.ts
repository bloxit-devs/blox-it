import { SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";
import { QInteraction } from "../../utils/QInteraction";

export class percentage extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("percentage")
                .setDescription("Get how [blank] a user is, in a percentage.")
                .addUserOption((opt) =>
                    opt.setName("user").setDescription("User to calculate percentage for").setRequired(true)
                )
                .addStringOption((opt) =>
                    opt.setName("phrase").setDescription("The thing to check for").setRequired(true).addChoices(
                        {
                            name: "Gay",
                            value: "Gay"
                        },
                        {
                            name: "Racist",
                            value: "Racist"
                        },
                        {
                            name: "Burger",
                            value: "<a:chezburgerspin:969554651215200286>"
                        },
                        {
                            name: "Femboy",
                            value: "Femboy"
                        },
                        {
                            name: "Catperson",
                            value: "Catperson 😾"
                        },
                        {
                            name: "Chad",
                            value: "<a:chad:950484809841508412>"
                        },
                        {
                            name: "Coolness",
                            value: "Cool"
                        },
                        {
                            name: "Male",
                            value: "Male ♂️"
                        },
                        {
                            name: "Female",
                            value: "Female ♀️"
                        },
                        {
                            name: "Attractiveness",
                            value: "Attractive"
                        }
                    )
                )
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const user = interaction.options.getUser("user", true);
        const phrase = interaction.options.getString("phrase", true);

        // Percentage
        const ranNum = Math.floor(Math.random() * 100);
        let percentage = Math.min(Math.max(ranNum, 0), 100);

        if (user.id === "299202375489683457" && phrase === "Gay") {
            percentage = 100
        }

        // Calculating colour gradient
        const red = (percentage / 100) * 0 + (1 - percentage / 100) * 255;
        const green = (percentage / 100) * 255 + (1 - percentage / 100) * 15;
        const blue = (percentage / 100) * 0 + (1 - percentage / 100) * 0;

        // Creating embed
        const embed = new EmbedBuilder()
            .setTitle(`Blox-it Rating • ${phrase}`)
            .setDescription(
                `I gaze into the crystal ball 🔮\nI see that, ${user} is **${percentage}%** ${phrase}! ${
                    percentage === 69 ? "*(nice)*" : ""
                }`
            )
            .setThumbnail(user.avatarURL())
            .setColor([red, green, blue]);

        // Sending reply
        interaction.reply({
            embeds: [embed]
        });
    }
}
