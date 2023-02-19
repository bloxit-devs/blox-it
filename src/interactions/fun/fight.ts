import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { QInteraction } from "../../utils/QInteraction";

export class fight extends QInteraction {
    public constructor() {
        super(
            new SlashCommandBuilder()
                .setName("fight")
                .setDescription("Choose two users to fight each other.")
                .addUserOption((opt) =>
                    opt
                    .setName("fighter1")
                    .setDescription("first user to fight")
                    .setRequired(true)
                )
                .addUserOption((opt) =>
                    opt
                    .setName("fighter2")
                    .setDescription("second user to fight")
                    .setRequired(true)
                ),
        );
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.Chat) {
        const fighter1 = interaction.options.getUser("fighter1");
        const fighter2 = interaction.options.getUser("fighter2");
        const randomWinner = Math.floor(Math.random() * 2 + 1);

        const randomFooters = [
            "We all knew this was going to happen.",
            "I'm not surprised.",
            "The winner was obvious.",
            "Surprising, but not really.",
            "Winner winner, chicken dinner.",
            "Sometimes you win, sometimes you lose.",
            "Imagine losing to this guy."
        ];

        const embed = new EmbedBuilder()
            .setTitle("It's a fight!")
            .setDescription(`After a long battle between ${fighter1} and ${fighter2}...\n ${randomWinner === 1 ? fighter1 : fighter2} has won!`)
            .setColor("Random")
            .setFooter(randomFooters[Math.floor(Math.random() * randomFooters.length)]);
        interaction.reply({ embeds: [embed] });
    }
}
