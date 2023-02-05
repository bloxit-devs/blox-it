import { PostEvent } from "../utils/events/PostEvent";
import { QEvent } from "../utils/events/BaseEvent";
import { Interaction, InteractionType as IType } from "discord.js";

export class PostInteractionCreate extends PostEvent {
    public constructor() {
        super("interactionCreate");
    }

    public execute(client: QEvent.QClient, interaction: Interaction) {
        // TODO: Possibly change how we handle errors (probably shouldn't throw)
        switch (interaction.type) {
            case IType.ApplicationCommand: {
                // Handles chat input and user/message context menu interactions
                const cmd = client.interactions?.get(interaction.commandName.toLowerCase());
                if (cmd) {
                    return cmd.execute(client, interaction);
                } else {
                    throw `Unknown command hit: ${interaction.commandName}`;
                }
            }
            case IType.ApplicationCommandAutocomplete: {
                const cmd = client.interactions?.get(interaction.commandName);
                if (cmd && cmd.components.has("autocomplete")) {
                    const compExec = cmd.components.get("autocomplete");
                    if (!compExec) return;
                    return compExec(interaction);
                } else {
                    throw `Autocomplete hit with no function for the command: ${interaction.commandName}`;
                }
            }
            case IType.MessageComponent:
            case IType.ModalSubmit: {
                // Handles buttons, select menus, and modals
                const [cmdName] = interaction.customId.split("|||");
                const cmd = client.interactions?.get(cmdName);
                if (cmd) {
                    const compExec = cmd.components.get(interaction.customId);
                    if (!compExec) return;
                    return compExec(interaction);
                } else {
                    throw `Unknown component hit: ${cmdName} // ${interaction.customId}`;
                }
            }
            default:
                return;
        }
    }
}
