import { Client, Collection, ClientOptions, ClientEvents } from "discord.js";
import { QInteraction } from "./QInteraction";
import { QEvent, ClientEvent } from "./events/BaseEvent";
import { PreEvent } from "./events/PreEvent";
import { PostEvent } from "./events/PostEvent";
import { config } from "dotenv";
import path from "path";
import { Module } from "./QModule";
import glob from "glob";

config();
const IS_DEVELOPMENT = process.env.NODE_ENV === "development" || process.env.TS_NODE_DEV;
const CUR_TOKEN = IS_DEVELOPMENT ? process.env.DEV_TOKEN : process.env.PRODUCTION_TOKEN;

/**
 * The extended client class for Discord.js
 * Includes interaction and event handling.
 */
export class QClient extends Client {
    interactions: Collection<string, QInteraction>;
    modules: Collection<string, Module>;
    events: Collection<QEvent.QClientEvents, { pre?: PreEvent; post?: PostEvent[] }>;
    loggedIn: boolean;

    constructor(options: ClientOptions) {
        super(options);
        this.interactions = new Collection();
        this.events = new Collection();
        this.modules = new Collection();
        this.loggedIn = false;
    }

    /**
     * Attempts to the log the bot into discord, will default to env variable DEV_TOKEN or PRODUCTION_TOKEN
     * @param token The token of the bot
     * @returns
     */
    public async login(token?: string) {
        if (!(token || CUR_TOKEN)) throw "You must supply a token!";
        if (IS_DEVELOPMENT) console.log("[QClient] Starting bot in development mode.");

        this.loggedIn = true;
        return super.login(token || CUR_TOKEN);
    }

    /**
     * Handles asynchronously loading classes from a directory
     * @param dir The absolute path to the folder
     * @param callback The function to run for each file loaded
     * @returns A table of the loaded files
     */
    private async loadFiles(dir: string): Promise<any> {
        dir = path.normalize(dir).split(path.sep).join("/");

        return new Promise((resolve) => {
            const translatedFiles: any[] = [];
            glob(`${dir}/**/*.js`, (err, files) => {
                files.forEach(async (file) => {
                    const name = path.parse(file.toString()).name;
                    const data = await import(`${file.toString()}`);
                    if (!data[name] || data.default) return;

                    const dataClass = new (data[name] || data.default)(this);
                    dataClass.name = dataClass.name === "module" ? name : dataClass.name;
                    translatedFiles.push(dataClass);
                });

                resolve(translatedFiles);
            });
        });
    }

    /**
     * Loads modules that are ran when the bot is started
     * @param dir The absolute directory of the modules folder
     */
    public async loadModules(dir: string): Promise<Collection<string, Module>> {
        if (!this.loggedIn) throw "Can only load modules after client#login";

        const modules: Module[] = await this.loadFiles(dir);
        return new Promise((resolve) => {
            Promise.all(
                modules.map((module) => {
                    return new Promise((resolve, reject) => {
                        if (module.exportModule) this.modules.set(module.name, module);
                        if (!module.autoInit) {
                            this.emit("moduleLoaded", module.name, module);
                            return resolve(module);
                        }

                        module
                            .init(this)
                            .then(() => {
                                resolve(module);
                                this.emit("moduleLoaded", module.name, module);
                            })
                            .catch((err) => reject(err));
                    });
                })
            )
                .then(() => resolve(this.modules))
                .catch((err) => {
                    console.log(`[QClient] Module failed to load ${err}`);
                });
        });
    }

    /**
     * Loads all of the interactions in a folder.
     * @param dir The absolute directory of the interactions folder
     */
    public loadInteractions(dir: string) {
        if (!this.loggedIn) throw "Can only load interactions after client#login";

        this.loadFiles(dir).then(async (cmds: QInteraction[]) => {
            cmds.forEach((cmd) => {
                const lowerName = cmd.builder.toJSON().name.toLowerCase();
                if (this.interactions?.has(lowerName))
                    throw `An interaction with the name ${lowerName} has already been registered.`;
                this.interactions?.set(lowerName, cmd);
            });
        });
    }

    /**
     * Loads all of the event classes in a folder and registers them to the client
     * @param dir The absolute directory of the events folder
     */
    public async loadEvents(dir: string) {
        if (!this.loggedIn) throw "Can only load events after client#login";

        // Populate events table
        await this.loadFiles(dir).then((files: ClientEvent[]) =>
            files.forEach((file) => {
                if (!file) return;
                file.init(this);
            })
        );

        // Registering events with client
        this.events?.forEach((callbackTable, event) => {
            const evnt = event as keyof ClientEvents;

            if (this.listeners(evnt).length > 0) return;
            this.on(evnt, (...args: any[]) => {
                const newArgs: QEvent.EventResult = args;
                if (callbackTable.pre && callbackTable.pre.execute) {
                    if (
                        !Array.isArray(newArgs)
                            ? callbackTable.pre.execute(this, ...newArgs)
                            : callbackTable.pre.execute(this, newArgs)
                    )
                        return;
                }

                // Fire post events
                if (callbackTable.post && callbackTable.post.length > 0) {
                    callbackTable.post.forEach((val) => {
                        if (!val.execute) return;
                        Array.isArray(newArgs) ? val.execute(this, ...newArgs) : val.execute(this, newArgs);
                    });
                }
            });
        });
    }
}
