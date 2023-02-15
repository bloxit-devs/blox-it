import { Module } from "../utils/QModule";
import { Sequelize } from "sequelize-typescript";
import path from "path";

export class Database extends Module {
    public sqlize?: Sequelize;

    constructor() {
        super({ exportModule: false });

        // Handle no database
        if (!process.env.DB_PATH) {
            console.log("[DB] Module Disabled: No DB_PATH specified in .env");
            return;
        }

        // Load database from env
        try {
            this.sqlize = new Sequelize({
                dialect: "sqlite",
                logging: false,
                storage: path.join("./", process.env.DB_PATH),
                models: [path.join(__dirname, "../models/*.ts"), path.join(__dirname, "../models/*.js")]
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
