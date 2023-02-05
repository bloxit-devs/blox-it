import { QClient } from "./utils/QClient";
import path from "path";

// Create bot
const client = new QClient({
    intents: ["MessageContent", "GuildMessages", "Guilds"],
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
