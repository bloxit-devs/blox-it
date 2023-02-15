import { Module } from "../utils/QModule";
import { fastify } from "fastify";
import { checkBanned } from "../models/User";
import { getCode, purgeOldCodes } from "../models/Code";
import { QClient } from "src/utils/QClient";

type APIRequest = {
    apikey: string;
    userid: number;
};

export class VerifyAPI extends Module {
    public constructor(client: QClient) {
        super({ exportModule: false });

        // Wait for database module to be loaded
        client.on("moduleLoaded", async (name) => {
            if (name !== "Database") return;
            console.log(`[VerifyAPI] Purged ${await purgeOldCodes()} codes.`);
        });
    }

    public async init(): Promise<void> {
        if (!process.env.API_KEY) {
            console.error("[VerifyAPI] Cannot start VerifyAPI! No API_KEY set in environment!");
            return;
        }

        // Start server
        const server = fastify();

        // Handle root
        server.route<{ Body: APIRequest }>({
            method: "POST",
            url: "/",
            schema: {
                body: {
                    type: "object",
                    properties: {
                        apikey: { type: "string" },
                        userid: { type: "number" }
                    }
                }
            },
            handler: async (req) => {
                if (req.body.apikey !== process.env.API_KEY) {
                    return {
                        statusCode: 401,
                        message: "Invalid API_KEY."
                    };
                }

                if (await checkBanned(req.body.userid)) {
                    return {
                        statusCode: 403,
                        message: "You are banned."
                    };
                }

                const code = await getCode(req.body.userid);
                if (code) {
                    return {
                        statusCode: 200,
                        code,
                        message: "Code supplied."
                    };
                } else {
                    return {
                        statusCode: 400,
                        message: "Failed to get code for user!"
                    };
                }
            }
        });

        await server
            .listen({
                port: parseInt(process.env.API_PORT ?? "1984"),
                host: process.env.API_HOST ?? "0.0.0.0"
            })
            .then((url) => console.log(`[VerifyAPI] Started server on ${url}`));
    }
}
