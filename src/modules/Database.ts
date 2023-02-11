import { Module } from "../utils/QModule";
import type { PrismaClient } from "@prisma/client";

export class Database extends Module {
    public prisma?: PrismaClient;

    constructor() {
        super({ exportModule: false });

        // Handle no database
        if (!process.env.DB_PATH) {
            console.log("[DB] Module Disabled: No DB_PATH specified in .env");
            return;
        }

        // Load database from env
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const prismaClient = require("@prisma/client").PrismaClient as typeof PrismaClient;
            this.prisma = new prismaClient();
        } catch (error) {
            console.warn(`[DB] Failed to load database: ${error}`);
        }
    }

    public async init(): Promise<void> {
        if (!this.prisma) return;
        console.log("[DB] Initialising");

        try {
            await this.prisma.$connect();
            console.log("[DB] Successfully authenticated");
        } catch (err) {
            console.error(`[DB] Failed to authenticate ${process.env.DB_PATH}: ${err}`);
            this.prisma.$disconnect();
        }
    }
}

export namespace Database {
    export type prisma = PrismaClient | undefined;
}
