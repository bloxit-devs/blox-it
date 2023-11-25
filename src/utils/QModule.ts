import { QClient } from "./QClient.js";

export abstract class Module {
    public name: string;
    public exportModule: boolean;
    public autoInit: boolean;

    public constructor(settings: ModuleSettings) {
        /* Handling Properties */
        this.exportModule = settings.exportModule === undefined ? false : settings.exportModule;
        this.name = settings.name || "module";
        this.autoInit = settings.autoInit === undefined ? true : settings.autoInit;
    }

    /**
     * Function called when the module has been loaded by the client
     * @param client The bot client
     */
    public abstract init(client?: QClient): Promise<void>;
}

export interface ModuleSettings {
    /**
     * The usage name of the module
     */
    name?: string;

    /**
     * Should the module be exported and added to the client?
     * 		Accessible through client.modules.get("name")
     */
    exportModule?: boolean;

    /**
     * Should the module be automatically initialised by the loader?
     */
    autoInit?: boolean;
}
