import axios, { AxiosError } from "axios";
import { Module } from "../utils/QModule";
import { getGuildChannels } from "../models/Guild";
import { QClient } from "../utils/QClient";
import { EmbedBuilder, HexColorString, TextChannel } from "discord.js";
import { start } from "repl";

enum Status {
    "Online",
    "Degraded",
    "Down",
    "Unknown"
}

interface StatusResponse {
    StatusCode: number;
    ResponseTime: number;
    ResponseMessage: string;
}

type Endpoint = { system: string; apis: { [name: string]: string } };

const ApiEndpoints = [
    {
        system: "Roblox",
        apis: {
            Avatar: "https://avatar.roblox.com/",
            "2FA": "https://twostepverification.roblox.com/",
            Thumbnails: "https://thumbnails.roblox.com/",
            Groups: "https://groups.roblox.com/",
            Economy: "https://economy.roblox.com/",
            Develop: "https://develop.roblox.com/"
        }
    }
] as Endpoint[];

const EndpointHistory = {} as { [endpoint: string]: Status };

/**
 * Helper method to assert if a set of promises is fulfilled
 * @param item The settled promise result
 */
const assertFullfilled = <T>(item: PromiseSettledResult<T>): item is PromiseFulfilledResult<T> => {
    return item.status === "fulfilled";
};

/**
 * Constructs the status embed
 * @param endpointName The name of the endpoint
 * @param status The statuscode of the endpoint
 * @returns The embedbuilder
 */
const createEmbed = (endpointName: string, response: StatusResponse) => {
    const status = convertStatusCode(response.StatusCode);
    let embedDescription: string;
    let embedColour: HexColorString;
    switch (status) {
        case Status.Online:
            embedDescription = "has improved performance.";
            embedColour = "#00FF00";
            break;
        case Status.Degraded:
            embedDescription = "has degraded performance.";
            embedColour = "#FFFF00";
            break;
        case Status.Down:
            embedDescription = "is experiencing an outage.";
            embedColour = "#FF0000";
            break;
        default:
            embedDescription = "has unknown status.";
            embedColour = "#000000";
            break;
    }

    return new EmbedBuilder()
        .setAuthor({ name: "Blox-it" })
        .setTitle(`\`${endpointName} API\` is ${Status[status]}.`)
        .setDescription(`${endpointName} API ${embedDescription}`)
        .setImage(`https://httpcats.com/${response.StatusCode}.jpg`)
        .setColor(embedColour)
        .addFields(
            { name: "Response Time", value: `\`\`\`${response.ResponseTime}ms\`\`\``, inline: true },
            { name: "Status Code", value: `\`\`\`${response.StatusCode}\`\`\``, inline: true },
            { name: "Response Message", value: `\`\`\`${response.ResponseMessage}\`\`\`` }
        )
        .setFooter({ text: "Posted by Blox-it" })
        .setTimestamp(new Date());
};

/**
 * Takes an endpoint name and creates a readable announcement for its status using the Status enum
 * @param endpointName The name of the endpoint
 * @param status The status code of the endpoint
 */
const announceApiStatus = (client: QClient, endpointName: string, response: StatusResponse) => {
    getGuildChannels()
        .then((guilds) => {
            guilds.forEach(async (guildInfo) => {
                if (!guildInfo.statusFeed) return false;

                // Getting guilds to post in
                const guild = await client.guilds.fetch(guildInfo.guildID);
                if (!guild) return false;

                // Finding guild channel
                const channel = (await guild.channels.fetch(guildInfo.statusFeed)) as TextChannel;
                if (!channel) return false;

                // Getting role pings
                // TODO: Add role pings for Degraded, Down, Active states

                // Posting message
                const message = await channel.send({
                    embeds: [createEmbed(endpointName, response)]
                    //allowedMentions: { roles: validatedRoles as string[] }
                });
                if (message.crosspostable) message.crosspost();
            });
        })
        .catch(() => {
            console.log("[StatusMonitor] Failed to getGuildChannels()");
        });
};

/**
 * Converts a status code into the status enum
 * @param statusCode The numerical status code
 * @returns
 */
const convertStatusCode = (statusCode: number): Status => {
    switch (statusCode) {
        case 200:
            return Status.Online;
        case 408:
        case 429:
        case 444:
            return Status.Degraded;
        case 500:
        case 502:
        case 503:
        case 504:
        case 521:
        case 522:
        case 523:
        case 524:
        case 598:
        case 599:
            return Status.Down;
        default:
            return Status.Unknown;
    }
};

/**
 * Handles an endpoint name and its status code
 * @param endpointName The string name of the endpoint
 * @param statusCode The status code the endpoint returned
 */
const handleURIStatus = (client: QClient, endpointName: string, response: StatusResponse) => {
    const status = convertStatusCode(response.StatusCode);
    if (status === Status.Unknown) return;

    const historyEntry = EndpointHistory[endpointName];
    if (historyEntry === undefined && status === Status.Online) {
        EndpointHistory[endpointName] = status;
        return;
    }

    if (historyEntry === status) return;
    EndpointHistory[endpointName] = status;
    announceApiStatus(client, endpointName, response);
};

/**
 * Loops through a specified list of endpoints and verifies against their status code
 * @param endpointSet The service and its endpoint grouping
 */
const checkEndpoints = async (client: QClient, endpointSet: Endpoint) => {
    const results = Object.entries(endpointSet.apis).map(([name, uri]) => {
        return new Promise<[string, StatusResponse]>((resolve, reject) => {
            axios
                .get(uri)
                .then((res) => {
                    resolve([
                        name,
                        {
                            StatusCode: res.status,
                            ResponseMessage: res.statusText,
                            ResponseTime: res.config.headers["X-Request-Duration"] ?? 0
                        }
                    ]);
                })
                .catch((err: AxiosError) => {
                    reject([
                        name,
                        {
                            StatusCode: err.status,
                            ResponseMessage: err.response?.statusText ?? "Unhandled Exception",
                            ResponseTime: err.response?.config.headers["X-Request-Duration"] ?? 0
                        }
                    ]);
                });
        });
    });

    const settledResults = await Promise.allSettled(results);
    settledResults
        .filter(assertFullfilled<[string, StatusResponse]>)
        .forEach((res) => handleURIStatus(client, ...res.value));
};

/**
 * Schedules endpoint checking against the specified endpoint set
 * @param endpointSet The endpoint set to check against
 * @param time The callback to determine the timeout at each rerun
 */
const scheduleEndpointCheck = (client: QClient, endpointSet: Endpoint, time: (setName: string) => number) => {
    const internalSchedule = async () => {
        await checkEndpoints(client, endpointSet);
        setTimeout(internalSchedule, time(endpointSet.system));
    };

    internalSchedule();
};

export class StatusMonitor extends Module {
    constructor(client: QClient) {
        super({ exportModule: false, autoInit: false });

        // Add axios interceptors
        axios.interceptors.request.use((config) => {
            config.headers["X-Request-Duration"] = new Date().getTime();
            return config;
        });

        axios.interceptors.response.use((response) => {
            const startTime = response.config.headers["X-Request-Duration"] as number;
            const endTime = new Date().getTime();
            response.config.headers["X-Request-Duration"] = endTime - startTime;
            return response;
        });

        // Call init method
        console.log("[StatusMonitor] Initialising");
        this.init(client);
    }

    public async init(client: QClient): Promise<void> {
        scheduleEndpointCheck(client, ApiEndpoints[0], () => 1000 * 60 * 15); // Check every 15 minutes
    }
}
