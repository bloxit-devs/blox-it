import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import path from "path";
import glob from "glob";

config();
const IS_DEVELOPMENT = process.env.NODE_ENV === "development" || process.env.TS_NODE_DEV;
const CLIENT_ID = IS_DEVELOPMENT ? process.env.DEV_CLIENT_ID : process.env.CLIENT_ID;
const CUR_TOKEN = IS_DEVELOPMENT ? process.env.DEV_TOKEN : process.env.PRODUCTION_TOKEN;

// Validating
if (!CLIENT_ID) throw new Error("No client id found");
if (!CUR_TOKEN) throw new Error("No token found");

// Construct and prepare an instance of the REST module
const rest = new REST({ version: "10" }).setToken(CUR_TOKEN);

const dir = path
    .normalize(__dirname + "/interactions")
    .split(path.sep)
    .join("/");

glob(dir + "/**/*.js", async (err, files) => {
    // eslint-disable-next-line promise/no-promise-in-callback
    const commands = await Promise.all(
        files.map(async (file) => {
            const name = path.parse(file.toString()).name;
            const data = await import(file.toString());
            return new data[name]().toJSON();
        })
    );

    try {
        console.log(`[Deploy] Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        if (IS_DEVELOPMENT && process.env.DEV_GUILD) {
            rest.put(Routes.applicationGuildCommands(CLIENT_ID, process.env.DEV_GUILD), { body: commands });
        } else {
            rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        }
    } catch (error) {
        console.error(error);
    }
});
