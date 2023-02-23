import { GatewayIntentBits } from "discord.js";
import { QClient } from "./utils/QClient";

// Create bot
const client = new QClient({
    intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds],
    allowedMentions: {
        parse: ["users", "roles"]
    }
});

// Load client
client.login();
client.once("ready", () => {
    client.loadEvents(__dirname + "/events");
    client.loadModules(__dirname + "/modules");
    client.loadInteractions(__dirname + "/interactions");

    // Telling PM2 we are ready
    if (process.send !== undefined) {
        process.send("ready");
        console.log("[Client] Bot Ready.");
    }
});
