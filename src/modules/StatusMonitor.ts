import axios, { AxiosError } from "axios";
import { Module } from "../utils/QModule";
import { getGuildChannels } from "../models/Guild";
import { QClient } from "../utils/QClient";
import { EmbedBuilder, HexColorString, TextChannel } from "discord.js";

enum Status {
    "Online",
    "Degraded",
    "Down",
    "Unknown"
}

interface StatusResponse {
    StatusCode: number;
    Status?: Status;
    ResponseTime: number;
    ResponseMessage: string;
    Endpoint: string;
}

interface HandledResponse {
    ShouldPost: boolean;
    Response: StatusResponse;
}

type GroupedResponses = Array<Array<StatusResponse>>;

type Endpoint = { system: string; apis: { [name: string]: string } };

const ApiEndpoints = [
    {
        system: "Roblox",
        apis: {
            "2FA API": "https://twostepverification.roblox.com/",
            "Account Settings": "https://accountsettings.roblox.com/",
            "Asset Delivery": "https://assetdelivery.roblox.com/",
            "Auth API": "https://auth.roblox.com/",
            "Avatar API": "https://avatar.roblox.com/",
            "Badges API": "https://badges.roblox.com/",
            "Billing API": "https://billing.roblox.com/",
            "Chat API": "https://chat.roblox.com/",
            "Contacts API": "https://contacts.roblox.com/",
            "DataStore API": "https://gamepersistence.roblox.com/",
            "Develop API": "https://develop.roblox.com/",
            "Economy API": "https://economy.roblox.com/",
            "Friends API": "https://friends.roblox.com/",
            "GameJoin API": "http://gamejoin.roblox.com/",
            "Games API": "http://games.roblox.com/",
            "Groups API": "https://groups.roblox.com/",
            "Inventory API": "https://inventory.roblox.com/",
            "Premium Features API": "https://premiumfeatures.roblox.com/",
            "Roblox Site": "https://www.roblox.com",
            "Thumbnails API": "https://thumbnails.roblox.com/",
            "Users API": "https://users.roblox.com/"
        }
    }
] as Endpoint[];

const EndpointHistory = {} as { [endpoint: string]: Status };

const ResponseTimeThresholdMS = 1250;

/**
 * Helper method to assert if a set of promises is fulfilled
 * @param item The settled promise result
 */
const isFulfilled = <T>(item: PromiseSettledResult<T>): item is PromiseFulfilledResult<T> => {
    return item.status === "fulfilled";
};

/**
 * Constructs the status embed
 * @param endpointName The name of the endpoint
 * @param status The statuscode of the endpoint
 * @returns The embedbuilder
 */
const createEmbed = (response: StatusResponse) => {
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
        .setTitle(`\`${response.Endpoint}\` is ${Status[status]}.`)
        .setDescription(`${response.Endpoint} API ${embedDescription}`)
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
 * Takes an array of endpoints and outputs them as one bulk message, should be used to group similar status messages
 * @param client The bot
 * @param statusGroup The grouping these responses belong to
 * @param responses The responses that are part of the group
 */
const announceApiStatus = (client: QClient, statusGroup: Status, responses: Array<StatusResponse>) => {
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
                    embeds: responses.map((response) => createEmbed(response))
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
        case 504:
            return Status.Degraded;
        case 500:
        case 502:
        case 503:
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
 * Checks an endpoint response and returns a handled response containing the input response and if it should post
 * @param response The endpoint response object
 */
const getHandledResponse = (response: StatusResponse): HandledResponse => {
    // Check status
    response.Status = convertStatusCode(response.StatusCode);
    const handledResponse: HandledResponse = {
        ShouldPost: true,
        Response: response
    };

    if (response.Status === Status.Unknown) {
        console.log(`Unhandled response from ${response.Endpoint} : ${response.StatusCode}`);
        handledResponse.ShouldPost = false;
    }

    // Check response times
    if (response.Status === Status.Online) {
        handledResponse.Response.Status =
            response.ResponseTime > ResponseTimeThresholdMS ? Status.Degraded : response.Status;
    }

    // Checking past status
    const historyEntry = EndpointHistory[response.Endpoint];
    if (historyEntry === undefined && response.Status === Status.Online) {
        EndpointHistory[response.Endpoint] = handledResponse.Response.Status ?? response.Status;
        handledResponse.ShouldPost = false;
    }

    if (historyEntry === response.Status) handledResponse.ShouldPost = false;
    EndpointHistory[response.Endpoint] = handledResponse.Response.Status ?? response.Status;
    return handledResponse;
};

/**
 * Loops through a specified list of endpoints and verifies against their status code
 * @param endpointSet The service and its endpoint grouping
 */
const checkEndpoints = async (client: QClient, endpointSet: Endpoint) => {
    const results = Object.entries(endpointSet.apis).map(([name, uri]) => {
        return new Promise<StatusResponse>((resolve, reject) => {
            axios
                .get(uri)
                .then((res) => {
                    resolve({
                        StatusCode: res.status,
                        ResponseMessage: res.statusText,
                        ResponseTime: res.config.headers["X-Request-Duration"] ?? 0,
                        Endpoint: name
                    });
                })
                .catch((err: AxiosError) => {
                    reject({
                        StatusCode: err.status,
                        ResponseMessage: err.response?.statusText ?? "Unhandled Exception",
                        ResponseTime: err.response?.config.headers["X-Request-Duration"] ?? 0,
                        Endpoint: name
                    });
                });
        });
    });

    // Getting results and grouping them by status
    const settledResults = await Promise.allSettled(results);
    const groupedResponses = settledResults
        .filter(isFulfilled<StatusResponse>)
        .map((res) => getHandledResponse(res.value))
        .filter((res) => res.ShouldPost)
        .reduce((group, res) => {
            if (res.Response.Status === undefined) return group;
            group[res.Response.Status] = group[res.Response.Status] || [];
            group[res.Response.Status].push(res.Response);
            return group;
        }, [] as GroupedResponses);

    // Announcing grouped status
    groupedResponses.forEach((responses, group) => announceApiStatus(client, group, responses));
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

        // Wait for database module to be loaded
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
