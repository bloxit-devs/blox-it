import axios, { AxiosError } from "axios";
import { Module } from "../utils/QModule";
import { getGuildChannels } from "../models/Guild";
import { QClient } from "../utils/QClient";
import { EmbedBuilder, TextChannel } from "discord.js";

enum Status {
    "Online",
    "Degraded",
    "Down",
    "Unknown"
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

const createEmbed = (endpointName: string, status: Status) => {
    const readableStatus = Status[status];
    let statusDescriptive: string;
    switch (status) {
        case Status.Online:
            statusDescriptive = "has improved performance.";
            break;
        case Status.Degraded:
            statusDescriptive = "has degraded performance.";
            break;
        case Status.Down:
            statusDescriptive = "is experiencing an outage.";
            break;
        default:
            statusDescriptive = "has unknown status.";
            break;
    }

    return new EmbedBuilder()
        .setTitle(`\`${endpointName} Api\` is ${readableStatus}.`)
        .setDescription(`${endpointName} ${statusDescriptive}`)
        .setFooter({ text: "Posted by Blox-it" })
        .setTimestamp(new Date());
};

/**
 * Takes an endpoint name and creates a readable announcement for its status using the Status enum
 * @param endpointName The name of the endpoint
 * @param status
 */
const announceApiStatus = (client: QClient, endpointName: string, status: Status) => {
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
                    embeds: [createEmbed(endpointName, status)]
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
 *
 * @param statusCode
 * @returns
 */
const convertStatusCode = (statusCode: number): Status => {
    switch (statusCode) {
        case 200:
            return Status.Online;
        case 429:
            return Status.Degraded;
        case 500:
        case 502:
        case 503:
        case 504:
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
const handleURIStatus = (client: QClient, endpointName: string, statusCode: number) => {
    const endpointStatus = convertStatusCode(statusCode);
    if (endpointStatus === Status.Unknown) return;

    const historyEntry = EndpointHistory[endpointName];
    if (historyEntry === undefined && endpointStatus === Status.Online) {
        EndpointHistory[endpointName] = endpointStatus;
        return;
    }

    if (historyEntry === endpointStatus) return;
    EndpointHistory[endpointName] = endpointStatus;
    announceApiStatus(client, endpointName, endpointStatus);
};

/**
 * Loops through a specified list of endpoints and verifies against their status code
 * @param endpointSet The service and its endpoint grouping
 */
const checkEndpoints = async (client: QClient, endpointSet: Endpoint) => {
    const results = Object.entries(endpointSet.apis).map(([name, uri]) => {
        return new Promise<[string, number]>((resolve, reject) => {
            axios
                .get(uri)
                .then((res) => {
                    resolve([name, res.status]);
                })
                .catch((err: AxiosError) => {
                    reject([name, err.status]);
                });
        });
    });

    const settledResults = await Promise.allSettled(results);
    settledResults.filter(assertFullfilled<[string, number]>).forEach((res) => handleURIStatus(client, ...res.value));
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

        client.on("moduleLoaded", (name) => {
            if (name !== "Database") return;
            console.log("[StatusMonitor] Initialising");
            this.init(client);
        });
    }

    public async init(client: QClient): Promise<void> {
        scheduleEndpointCheck(client, ApiEndpoints[0], () => 1000 * 60 * 15); // Check every 15 minutes
    }
}
