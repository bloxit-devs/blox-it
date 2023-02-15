import {
    Collection,
    ActionRowBuilder,
    JSONEncodable,
    RESTPostAPIApplicationCommandsJSONBody,
    ChatInputCommandInteraction,
    MessageContextMenuCommandInteraction,
    UserContextMenuCommandInteraction,
    Interaction,
    ButtonBuilder,
    ButtonStyle,
    APIButtonComponentWithCustomId,
    ComponentBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    AutocompleteInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    StringSelectMenuInteraction,
    AnyComponentBuilder,
    TextInputBuilder
} from "discord.js";

export type ComponentExecute<T extends QInteraction.Interactions> = (interaction: T) => void;
export type CommandBuilders = JSONEncodable<RESTPostAPIApplicationCommandsJSONBody>;

export abstract class QInteraction {
    readonly builder: CommandBuilders = undefined!;
    readonly components: Collection<string, ComponentExecute<any>> = new Collection();
    readonly rows: Collection<string, ActionRowBuilder<any>> = new Collection();
    readonly modals: Collection<string, ModalBuilder> = new Collection();

    private commandName: string;

    public constructor(builder: CommandBuilders) {
        this.builder = builder;

        this.commandName = builder.toJSON().name;
    }

    /**
     * Return the builder JSON
     * (This is so the collection of interactions returns JSON properly for registration)
     * @returns RESTPostAPIApplicationCommandsJSONBody
     */
    public toJSON(): RESTPostAPIApplicationCommandsJSONBody {
        return this.builder.toJSON();
    }

    /**
     * Add a component to an action row
     * @param row The name of the row to add it to
     * @param builder The builder to add to the collection
     */
    private addToRow(row: string, builder: ComponentBuilder) {
        if (this.rows.has(row)) {
            this.rows.get(row)?.addComponents(builder);
        } else {
            this.rows.set(row, new ActionRowBuilder<any>().addComponents(builder));
        }
    }

    /**
     * Add a button to an action row
     * @param builder The button builder
     * @param actionRow The action row to add it to
     * @param execute The execute function to run when pressed
     */
    public addButton(builder: ButtonBuilder, actionRow: string, execute?: ComponentExecute<QInteraction.Button>) {
        if (builder.data.style !== ButtonStyle.Link) {
            const button = builder.toJSON() as APIButtonComponentWithCustomId;
            if (!execute) throw "A non-URL button must have an execute function!";
            if (!button.custom_id) throw "A non-URL button must have an execute function!";

            const newID = `${this.commandName}|||${button.custom_id}`;

            builder.setCustomId(newID);
            if (this.components.has(newID)) throw `The custom ID ${button.custom_id} already exists for ${this.commandName}`;
            this.components.set(newID, execute!);
        }

        this.addToRow(actionRow, builder);
    }

    /**
     * Add a select menu to the interaction
     * @param builder The select menu builder
     * @param actionRow The action row to add the select menu to
     * @param execute The execute function to run when the options change
     */
    public addSelectMenu(
        builder: StringSelectMenuBuilder,
        actionRow: string,
        execute: ComponentExecute<QInteraction.SelectMenu>
    ) {
        if (!execute) throw "A select menu must have an execute function!";
        if (!builder.data.custom_id) throw "A select menu must have a custom id!";

        const newID = `${this.commandName}|||${builder.data.custom_id}`;

        builder.setCustomId(newID);
        if (this.components.has(newID))
            throw `The custom ID ${builder.data.custom_id} already exists for ${this.commandName}`;
        this.components.set(newID, execute!);

        this.addToRow(actionRow, builder);
    }

    /**
     * Add a text input to an action row
     * @param builder The text input builder
     * @param actionRow The action row to add it to
     */
    public addTextInput(builder: TextInputBuilder, actionRow: string) {
        if (!builder.data.custom_id) throw "A text input must have a custom id!";

        if (this.rows.has(actionRow)) throw "Text inputs must be one per row with no other components!";

        this.addToRow(actionRow, builder);
    }

    /**
     * Add an autocomplete handler to the interaction
     * You must set autocomplete on a slash command option for this to be called!
     * @param execute The function to run when recieved
     */
    public addAutocomplete(execute: ComponentExecute<QInteraction.Autocomplete>) {
        if (this.components.has("autocomplete")) throw "An autocomplete handler has already been registered!";

        this.components.set("autocomplete", execute);
    }

    /**
     * Add a modal to the interaction
     * @param builder The modal builder
     * @param execute The function to run when the modal has been completed
     */
    public addModal(builder: ModalBuilder, execute: ComponentExecute<QInteraction.ModalSubmit>) {
        if (!builder.data.custom_id) throw "A modal must have a custom id!";

        const newID = `${this.commandName}|||${builder.data.custom_id}`;

        builder.setCustomId(newID);
        if (this.components.has(newID))
            throw `The custom ID ${builder.data.custom_id} already exists for ${this.commandName}`;
        this.components.set(newID, execute);

        this.modals.set(builder.data.custom_id, builder);
    }

    /**
     * Get action rows via the name
     * @param rowNames The names to try and get
     * @returns Array of ActionRowBuilder with the specified type
     */
    public getRows<T extends AnyComponentBuilder>(...rowNames: string[]): ActionRowBuilder<T>[] {
        const rows: ActionRowBuilder<T>[] = [];

        rowNames.forEach((rowName) => {
            rows.push(this.rows.get(rowName) as ActionRowBuilder<T>);
        });

        return rows;
    }

    /**
     * Get a modal from the interaction
     * @param modalID
     * @returns The modal builder if it exists or undefined
     */
    public getModal(modalID: string): ModalBuilder | undefined {
        return this.modals.get(`${this.commandName}|||${modalID}`);
    }

    /**
     * Function called when the interaction is executed
     * @param client
     * @param interaction
     */
    public abstract execute(client: QInteraction.Client, interaction: QInteraction.Interactions): void;
}

export namespace QInteraction {
    export type Interactions = Interaction;
    export type Chat = ChatInputCommandInteraction;
    export type MessageContext = MessageContextMenuCommandInteraction;
    export type UserContext = UserContextMenuCommandInteraction;
    export type SelectMenu = StringSelectMenuInteraction;
    export type Button = ButtonInteraction;
    export type Autocomplete = AutocompleteInteraction;
    export type ModalSubmit = ModalSubmitInteraction;
    export type Client = import("./QClient").QClient;
}
