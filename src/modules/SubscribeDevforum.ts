import axios, { AxiosError } from "axios";
import { QClient } from "../utils/QClient.js";
import { Module } from "../utils/QModule.js";
import { getGuildChannels } from "../models/Guild.js";
import { getRecentRelease, setRecentRelease } from "../models/Bot.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedAuthorOptions, EmbedBuilder, TextChannel } from "discord.js";
import { config } from "dotenv";
import { parseDocument, DomUtils } from "htmlparser2";

/* Announcements, News/Alerts, Release Notes */
const CATEGORIES_WATCHING = [36, 193];
const RELEASE_NOTES = "https://create.roblox.com/docs/release-notes/release-notes-";
const FORUM_LINK = "https://devforum.roblox.com/c/updates/45.json";
const DEFAULT_IMAGE =
    "https://devforum-uploads.s3.dualstack.us-east-2.amazonaws.com/uploads/original/4X/c/e/2/ce2bb810f2a76b08be421b703f7f0e20750a6004.png";
const MS_TO_MIN = 1000 * 60;

config();
const IS_DEVELOPMENT = process.env.NODE_ENV === "development" || process.env.TS_NODE_DEV;
const CLIENT_ID = IS_DEVELOPMENT ? process.env.DEV_CLIENT_ID : process.env.CLIENT_ID;

const SCHEDULED_CHECKS: Record<number, number> = [];
const CACHED_POSTS: Array<number> = [];

let throttleForum = false;
let throttleReleases = false;

/**
 * The category ID enum
 */
enum Category {
    "developer_discussion" = 8,
    "creations" = 20,
    "announcements" = 36,
    "updates" = 45,
    "help_and_feedback" = 54,
    "scripting_support" = 55,
    "building_support" = 56,
    "art_support" = 57,
    "release_notes" = 62,
    "code_review" = 75,
    "community" = 90,
    "design_support" = 103,
    "news_alerts" = 193,
    "education_support" = 197
}

/**
 * The data of a topic or release note
 */
type PostData = {
    id: number;
    fancy_title: string;
    image_url: string;
    created_at: string;
    category_id: Category;
    ping_roles?: boolean;
};

/**
 * Type returned by a specific post
 */
type post = {
    id: number;
    topic_id: number;
    created_at: string;
    /**
     * The html post content
     */
    cooked: string;
};

/**
 * Returned by a specific topic json file
 *  (1234.json)
 */
type TopicSummary = {
    post_stream: {
        posts: post[];
    };
    details: {
        /**
         * Details of the user that created the post
         */
        created_by: {
            id: number;
            /**
             * The users roblox username
             */
            username: string;
            /**
             * The users display name
             */
            name?: string;
            avatar_template: string;
        };
    };
};

/**
 * An object returned by the navigation pageProps for the roblox documentation site
 */
type DocElement = {
    title: string;
    path?: string;
    section: DocElement[];
};

type NavElement = {
    heading: string;
    slugs?: string[];
    navigation: DocElement[] | NavElement[];
};

/**
 * Supported html entities to be decoded
 */
type htmlEntities = "nbsp" | "lt" | "gt" | "amp" | "quot" | "apos";

/**
 * Supported html tags
 */
type htmlTags = "strong" | "b" | "blockquote" | "code" | "i";

/**
 * Decodes html entities such as &amp; into their actual form
 * @param encodedString
 * @returns
 */
const decodeHTML = (encodedString: string): string => {
    const translate_re = /&(nbsp|lt|gt|amp|quot|apos);/g;
    const translate_tag = /(<([/]*)(strong|b|blockquote|code|i)>)/g;
    const translateEntities = {
        nbsp: " ",
        lt: "<",
        gt: ">",
        amp: "&",
        quot: '"',
        apos: "'",
        ldquo: "“",
        rdquo: "”"
    };
    const translateTags = {
        strong: "**",
        b: "**",
        blockquote: ">",
        code: "`",
        i: "*"
    };
    return encodedString
        .replace(translate_re, function (match, entity: htmlEntities) {
            return translateEntities[entity];
        })
        .replace(translate_tag, function (match, tag: string) {
            const normalisedTag = tag.replace(/([/<>])/g, "") as htmlTags;
            return translateTags[normalisedTag];
        })
        .replace(/&#(\d+);/gi, function (match, numStr) {
            const num = parseInt(numStr, 10);
            return String.fromCharCode(num);
        })
        .replace(/(<([^>]+)>)/gi, "");
};

/**
 * Gets the Build ID for the documentation
 */
const getNextBuildID = async (module: SubscribeDevforum) => {
    if (!CLIENT_ID) return;
    const previousRelease = await getRecentRelease(CLIENT_ID);
    const buildIdLink = previousRelease
        ? `${RELEASE_NOTES}${previousRelease >= 9999 ? 550 : previousRelease}`
        : `https://create.roblox.com/docs/reference/engine`;

    return axios.get(buildIdLink, { responseType: "document", transformResponse: [(v) => v] }).then((res) => {
        // Handling invalid result
        if (!res.data) return;
        if (res.status !== 200) return;

        const document = parseDocument(res.data);
        const elements = DomUtils.findOne((element) => {
            return element.attribs.id === "__NEXT_DATA__";
        }, document.childNodes);
        const element: any = elements?.children[0];
        const elementData = JSON.parse(element.data);

        module.build_id = elementData.buildId;
        return elementData.buildId;
    });
};

/**
 * Gets additional information from a devforum post
 * @param URL The url to the devforum post
 * @returns The description and author of the post
 */
const getAdditionalPostInfo = async (URL: string) => {
    return axios.get(`${URL}.json`).then((extendedTopic) => {
        const data: TopicSummary = extendedTopic.data;
        if (!data) return { description: false, author: false };

        // Getting the original post
        const firstPost: post = data.post_stream.posts[0];
        if (!firstPost) return { description: false, author: false };

        // Formatting description
        const description: string = decodeHTML(firstPost.cooked)
            .replace(/(<([^>]+)>)/gi, "")
            .replace(/(\r\n|\n|\r)/gm, " ")
            .trim();
        const trimmedDescription: string =
            description.length > 250 ? description.substring(0, 250).trimEnd() + `... [Read More](${URL})` : description;

        // Getting created by information
        const details = data.details.created_by;
        if (!details) return { description: trimmedDescription, author: false };

        // Returning object
        return {
            description: trimmedDescription,
            author: {
                name: details.name !== details.username ? `${details.name} (@${details.username})` : `${details.username}`,
                iconURL: `https://devforum.roblox.com${(details.avatar_template as string).replace("{size}", "360")}`,
                url: `https://devforum.roblox.com/u/${details.username}`
            }
        };
    });
};

/**
 * Creates a new embed with the provided postData
 * @param postData The post data
 * @returns A promise with the loaded embed and action row
 */
const createEmbed = async (postData: PostData) => {
    // Getting embed data
    const ImageURL = postData.image_url === "null" ? DEFAULT_IMAGE : postData.image_url;
    const URL =
        postData.category_id !== Category.release_notes
            ? `https://devforum.roblox.com/t/${postData.id}`
            : `${RELEASE_NOTES}${postData.id}`;

    // Creating Embed
    const embed = new EmbedBuilder()
        .setTitle(decodeHTML(postData.fancy_title))
        .setThumbnail(ImageURL)
        .setDescription(`Notes for ${decodeHTML(postData.fancy_title)}\n\n`)
        .setFooter({ text: "Posted" })
        .setURL(URL)
        .setColor("#2F3136")
        .setTimestamp(new Date(postData.created_at))
        .setAuthor({
            name: "System",
            iconURL: DEFAULT_IMAGE,
            url: "https://devforum.roblox.com/u/System"
        });

    // Creating action row
    let row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(URL)
            .setLabel(`View ${postData.category_id === Category.release_notes ? "Release" : "Post"}`)
    );

    // Setting description based on category
    if (postData.category_id === Category.release_notes) {
        embed.setDescription(`Notes for Release ${postData.id}`);

        // Adding additonal action bar row buttons
        row = row.addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(`https://maximumadhd.github.io/Roblox-API-History.html#${postData.id}`)
                .setLabel("Client Diff")
        );
    } else {
        const { description, author } = await getAdditionalPostInfo(URL);
        if (description) embed.setDescription(description as string);
        if (author) embed.setAuthor(author as EmbedAuthorOptions);
    }

    return { embed: embed, row: row };
};

/**
 *
 * @param client
 * @param postData
 * @param guildInfo
 * @returns
 */
const createPost = async (client: QClient, postData: PostData) => {
    const guilds = await getGuildChannels();
    return Promise.all(
        guilds.map(async (guildInfo) => {
            // Adding post to cache
            if (!CACHED_POSTS.includes(postData.id)) CACHED_POSTS.push(postData.id);

            // Getting guilds to post in
            const guild = await client.guilds.fetch(guildInfo.guildID);
            if (!guild) return false;

            // Getting channel id to post to
            const chosenChannelID =
                postData.category_id === Category.release_notes ? guildInfo.rbxReleases : guildInfo.rbxUpdates;
            if (!chosenChannelID) return false;

            // Finding actual channel
            const channel = (await guild.channels.fetch(chosenChannelID)) as TextChannel;
            if (!channel) return false;

            // Getting role pings
            const roleType = postData.category_id === Category.release_notes ? "releaseRole" : "updateRole";
            const roles = [guildInfo.allRole, guildInfo[roleType]] as (string | undefined)[];
            const validatedRoles = roles.filter((role) => role);
            const printRoles = validatedRoles.map((role) => `<@&${role}>`).join(" ");

            // Setting image
            postData.image_url = (postData.image_url?.startsWith("//") ? "https:" : "") + postData.image_url;

            // Creating embed
            const { embed, row } = await createEmbed(postData);

            // Posting message
            const message = await channel.send({
                content: postData.ping_roles ? printRoles : "",
                embeds: [embed],
                components: [row],
                allowedMentions: { roles: validatedRoles as string[] }
            });
            if (message.crosspostable) await message.crosspost();
        })
    );
};

/**
 *
 * @param posts
 * @returns
 */
const handlePosts = async (client: QClient, posts: PostData[]) => {
    // Filtering topics
    const topics: PostData[] = posts.filter((post: PostData) => {
        if (!CATEGORIES_WATCHING.includes(post.category_id)) return false;

        if (CACHED_POSTS.includes(post.id)) return false;

        if ((Date.now() - new Date(post.created_at).getTime()) / MS_TO_MIN > 15) return false;

        return true;
    });

    // Posting all valid topics
    if (!topics || topics.length <= 0) return;
    topics.reverse().forEach((post, index) => {
        CACHED_POSTS.push(post.id);
        if (CACHED_POSTS.length > 10) CACHED_POSTS.shift();
        createPost(client, { ...post, ping_roles: index <= 0 });
    });
};

/**
 * Performs a get request on the devforum update category for the latest posts.
 * Filters the posts to get the newest and unread ones.
 */
const pollDevforum = (module: SubscribeDevforum, client: QClient) => {
    axios
        .get(FORUM_LINK)
        .then((result) => {
            // Handling invalid result
            if (!result.data) return;
            if (result.status < 200 || result.status > 200) return;
            throttleForum = false;

            // Remove oldest post from cache if reached max
            if (CACHED_POSTS.length > 10) CACHED_POSTS.shift();
            handlePosts(client, result.data.topic_list.topics);
        })
        .catch((err) => {
            if (throttleForum) return;
            throttleForum = true;

            if (err.response) {
                console.log(
                    `[ForumNotifier] Failed to retrieve devforum posts - server responded with ${err.response.status}: (${err.response.data})`
                );
            } else if (err.request) {
                console.log(`[ForumNotifier] Failed to retrieve devforum posts - no response: (${err.request})`);
            } else {
                console.log(`[ForumNotifier] Failed to retrieve devforum posts - generic error: (${err.message})`);
            }
        });
};

/**
 * Checks if a release note is valid and can be accessed.
 * @param releaseNumber
 * @returns
 */
const checkReleaseNoteValid = async (releaseNumber: string): Promise<boolean> => {
    try {
        const data = await axios.get(`${RELEASE_NOTES}${releaseNumber}`);

        // Return if if the release note is valid
        return data && data.status === 200;
    } catch (e) {
        console.info(`[ForumNotifier] Failed to access release notes (${RELEASE_NOTES}${releaseNumber}) Exception: ${e}`);
        return false;
    }
};

/**
 * Performs a get request on the create site for release notes,
 * uses the Next BuildID to get the site json for categories to determine
 * if a new release note is available on the 'current category' link
 */
const pollReleaseNotes = async (module: SubscribeDevforum, client: QClient) => {
    // Checking Client
    if (!CLIENT_ID) return;
    const oldRelease = await getRecentRelease(CLIENT_ID);
    const jsonDataUrl = !oldRelease
        ? `https://create.roblox.com/docs/_next/data/${module.build_id}/reference/engine.json`
        : `https://create.roblox.com/docs/_next/data/${module.build_id}/release-notes/release-notes-${
              oldRelease >= 9999 ? 550 : oldRelease
          }.json`;

    axios
        .get(jsonDataUrl)
        .then(async (result) => {
            // Handling invalid result
            if (!result.data) return;
            if (result.status < 200 || result.status > 200) return;
            throttleReleases = false;

            // Getting release paths
            const navigation: NavElement[] = result.data.pageProps.navigation.navigationContent;
            const releaseNotes: DocElement[] = navigation.find((element) => element.heading === "Release Notes")
                ?.navigation as DocElement[];

            // Getting relese note
            const currentRelease = releaseNotes?.find((element) => element.title === "Current Release");
            const releaseNumber = currentRelease?.path?.split("-").pop();
            if (releaseNumber === undefined) return;

            // Checking release number
            const parsedReleaseNum = parseInt(releaseNumber);
            if (!oldRelease || (oldRelease && oldRelease >= 9999)) {
                setRecentRelease(CLIENT_ID, parsedReleaseNum - 1);
            } else if (oldRelease && oldRelease >= parsedReleaseNum) {
                return;
            }

            // Ensuring release note is valid
            if (!checkReleaseNoteValid(releaseNumber)) return;

            // Setting database
            setRecentRelease(CLIENT_ID, parsedReleaseNum);

            // Posting release
            let shouldPing = true;
            for (let release = oldRelease ? oldRelease + 1 : parsedReleaseNum; release <= parsedReleaseNum; release++) {
                // Check if post is valid
                if (!checkReleaseNoteValid(release.toString())) continue;

                // Make post
                await createPost(client, {
                    id: release,
                    fancy_title: `Release Notes for ${release}`,
                    image_url: DEFAULT_IMAGE,
                    created_at: new Date().toISOString(),
                    category_id: Category.release_notes,
                    ping_roles: shouldPing
                });
                shouldPing = false;
            }
        })
        .catch((err: AxiosError) => {
            if (throttleReleases || err.response?.status === 404) {
                getNextBuildID(module);
            }
            throttleReleases = true;

            if (err.response) {
                console.log(
                    `[ForumNotifier] Failed to retrieve release notes - server responded with ${err.response.status})`
                );
            } else if (err.request) {
                console.log(`[ForumNotifier] Failed to retrieve release notes - no response: (${err.request})`);
            } else {
                console.log(`[ForumNotifier] Failed to retrieve release notes - generic error: (${err.message})`);
            }
        });
};

/**
 * @param callback method called on the schedule
 * @param getTime method called to get the interval
 */
const runScheduledCheck = (callback: () => number) => {
    let intervalId: number | undefined;
    const run = () => {
        const interval = callback();
        if (!intervalId || SCHEDULED_CHECKS[intervalId] !== interval) {
            clearInterval(intervalId);
            intervalId = setInterval(run, interval)[Symbol.toPrimitive]();
            SCHEDULED_CHECKS[intervalId] = interval;
        }
    };
    run();
};

/**
 * Polls the devforum for new topics and posts in specified categories
 */
export class SubscribeDevforum extends Module {
    public build_id!: string;

    public constructor(client: QClient) {
        super({ autoInit: false });

        // Wait for database module to be loaded
        client.on("moduleLoaded", (name) => {
            if (name !== "Database") return;
            console.log("[ForumNotifier] Initialising");
            getNextBuildID(this).then(() => {
                this.init(client);
            });
        });
    }

    public async init(client: QClient): Promise<void> {
        runScheduledCheck(() => {
            pollDevforum(this, client);
            return throttleForum ? 5 * 1000 * 60 : 1 * 1000 * 60;
        });

        runScheduledCheck(() => {
            pollReleaseNotes(this, client);
            return throttleReleases ? 5 * 1000 * 60 : 1 * 1000 * 60;
        });
    }
}
