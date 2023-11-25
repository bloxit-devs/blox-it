import { Module } from "../utils/QModule.js";
import Hapi from "@hapi/hapi";
import Boom from "@hapi/boom";
import Joi from "joi";
import { checkBanned } from "../models/User.js";
import { getCode, purgeOldCodes } from "../models/Code.js";
import { QClient } from "src/utils/QClient.js";

type APIRequest = {
    payload: {
        apikey: string;
        userid: number;
    };
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
        const server = Hapi.server({
            port: process.env.API_PORT || 1984,
            host: process.env.API_HOST || "0.0.0.0"
        });

        // Handle root
        server.route({
            method: "POST",
            path: "/",
            handler: async (req: APIRequest) => {
                if (req.payload.apikey !== process.env.API_KEY) {
                    return {
                        statusCode: 401,
                        message: "Invalid API_KEY."
                    };
                }

                if (await checkBanned(req.payload.userid)) {
                    return {
                        statusCode: 403,
                        message: "You are banned."
                    };
                }

                const code = await getCode(req.payload.userid);
                if (code) {
                    return {
                        statusCode: 200,
                        code: code,
                        message: "Code supplied."
                    };
                } else {
                    return Boom.badData("Failed to get code for user!");
                }
            },
            options: {
                validate: {
                    payload: Joi.object({
                        apikey: Joi.string().required(),
                        userid: Joi.number().required()
                    })
                }
            }
        });

        await server.start();
        console.log("[VerifyAPI] Started server on %s", server.info.uri);
    }
}
