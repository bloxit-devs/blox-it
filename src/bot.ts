import { QClient } from "./utils/QClient";

// Create bot
const client = new QClient({
    intents: ["MessageContent", "GuildMessages", "GuildMembers", "Guilds", "GuildMessageReactions"],
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
