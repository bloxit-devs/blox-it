import { Module } from "../utils/QModule.js";
import { ModelCtor, Sequelize } from "sequelize-typescript";
import { parse } from "node:path/posix";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import glob from "fast-glob";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Database extends Module {
    public sqlize?: Sequelize;

    constructor() {
        super({ exportModule: false });

        // Handle no database
        if (!process.env.DB_PATH) {
            console.log("[DB] Module Disabled: No DB_PATH specified in .env");
            return;
        }

        this.setupDatabase();
    }

    private async setupDatabase(): Promise<void> {
        // Load database from env
        try {
            const models: ModelCtor[] = await glob(
                join(__dirname, "..", "models").replaceAll("\\", "/") + "/*.{ts,js}"
            ).then((files) =>
                Promise.all(
                    files.map(async (file) => {
                        const name = parse(file).name;
                        const data = await import(pathToFileURL(file).toString());

                        return data[name] || data.default;
                    })
                )
            );

            this.sqlize = new Sequelize({
                dialect: "sqlite",
                logging: false,
                storage: join("./", process.env.DB_PATH!),
                models
            });
        } catch (error) {
            console.warn(`[DB] Failed to load database: ${error}`);
        }
    }

    public async init(): Promise<void> {
        if (!this.sqlize) return;
        console.log("[DB] Initialising");

        try {
            await this.sqlize.authenticate();
            console.log("[DB] Successfully authenticated");
        } catch (err) {
            console.error(`[DB] Failed to authenticate ${process.env.DB_PATH}: ${err}`);
            this.sqlize.close();
        }

        await this.sqlize.sync({
            force: process.env.DB_CLEAR === "true"
        });
    }
}

export namespace Database {
    export type sqlize = Sequelize | undefined;
}
