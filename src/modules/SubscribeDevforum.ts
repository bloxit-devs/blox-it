import axios from "axios";
import { QClient } from "../utils/QClient";
import { Module } from "../utils/QModule";
import { getGuildChannels } from "../models/Guild";
import { getRecentRelease, setRecentRelease } from "../models/Bot";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedAuthorOptions, EmbedBuilder, TextChannel } from "discord.js";
import { config } from "dotenv";
import { parseDocument, DomUtils } from "htmlparser2";

/* Announcements, News/Alerts, Release Notes */
const CATEGORIES_WATCHING = [36, 193];
const RELEASE_NOTES = "https://create.roblox.com/docs/resources/release-note/Release-Note-for-";
const FORUM_LINK = "https://devforum.roblox.com/c/updates/45.json";
const DEFAULT_IMAGE =
    "https://devforum-uploads.s3.dualstack.us-east-2.amazonaws.com/uploads/original/4X/c/e/2/ce2bb810f2a76b08be421b703f7f0e20750a6004.png";
const MS_TO_MIN = 1000 * 60;

config();
const IS_DEVELOPMENT = process.env.NODE_ENV === "development" || process.env.TS_NODE_DEV;
const CLIENT_ID = IS_DEVELOPMENT ? process.env.DEV_CLIENT_ID : process.env.CLIENT_ID;

const cachedPosts: number[] = [];
let throttleForum = false;
let throttleReleases = false;
let forumIntervalID: NodeJS.Timer | undefined;
let releaseIntervalID: NodeJS.Timer | undefined;

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
        apos: "'"
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
const getNextBuildID = (module: SubscribeDevforum) => {
    return axios
        .get("https://create.roblox.com/docs", { responseType: "document", transformResponse: [(v) => v] })
        .then((res) => {
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
    getGuildChannels()
        .then((guilds) => {
            guilds.forEach(async (guildInfo) => {
                // Adding post to cache
                if (!cachedPosts.includes(postData.id)) cachedPosts.push(postData.id);

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
                const validatedRoles = roles.filter((role) => role !== undefined && role !== null);
                const printRoles = validatedRoles.map((role) => `<@&${role}>`).join(" ");

                // Setting image
                postData.image_url = (postData.image_url?.startsWith("//") ? "https:" : "") + postData.image_url;

                // Creating embed
                const { embed, row } = await createEmbed(postData);

                // Posting message
                const message = await channel.send({
                    content: printRoles,
                    embeds: [embed],
                    components: [row],
                    allowedMentions: { roles: validatedRoles as string[] }
                });
                if (message.crosspostable) message.crosspost();
            });
        })
        .catch(() => {
            console.log("[ForumNotifier] Failed to getGuildChannels()");
        });
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

        if (cachedPosts.includes(post.id)) return false;

        if ((Date.now() - new Date(post.created_at).getTime()) / MS_TO_MIN > 15) return false;

        return true;
    });

    // Posting all valid topics
    if (!topics || topics.length <= 0) return;
    topics.reverse().forEach((post) => {
        cachedPosts.push(post.id);
        if (cachedPosts.length > 10) cachedPosts.shift();
        createPost(client, post);
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
            if (result.status !== 200) return;

            // Disabling timer throttling
            if (throttleForum) {
                throttleForum = false;
                clearInterval(forumIntervalID);
                forumIntervalID = undefined;
                module.init(client);
                return;
            }

            // Remove oldest post from cache if reached max
            if (cachedPosts.length > 10) cachedPosts.shift();
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

            /* Clear interval */
            clearInterval(forumIntervalID);
            forumIntervalID = undefined;
            module.init(client);
            return;
        });
};

/**
 *
 */
const pollReleaseNotes = (module: SubscribeDevforum, client: QClient) => {
    // Checking Client
    if (!CLIENT_ID) return;

    axios
        .get(`https://create.roblox.com/docs/_next/data/${module.build_id}/getting-started.json`)
        .then(async (result) => {
            // Handling invalid result
            if (!result.data) return;
            if (result.status !== 200) return;

            // Disabling timer throttling
            if (throttleReleases) {
                throttleReleases = false;
                clearInterval(forumIntervalID);
                forumIntervalID = undefined;
                module.init(client);
                return;
            }

            // Getting release paths
            const navigation: NavElement[] = result.data.pageProps.data.navigation;
            const resources: DocElement[] = navigation.find((element) => element.heading === "Resources")
                ?.navigation as DocElement[];

            // Getting relese note
            const releaseNotes: DocElement | undefined = resources.find((element) => element.title === "Release Notes");
            const currentRelease = releaseNotes?.section.find((element) => element.title === "Current Release");
            let releaseNumber = currentRelease?.path?.split("-").pop();
            if (releaseNumber === undefined) return;

            // Checking release number
            const oldRelease = await getRecentRelease(CLIENT_ID);
            if (oldRelease && oldRelease >= parseInt(releaseNumber)) {
                releaseNumber = (oldRelease + 1).toString();

                // Attempt to check if next release is available
                let data;
                try {
                    // eslint-disable-next-line prefer-const
                    data = await axios.get(
                        `https://create.roblox.com/docs/resources/release-note/Release-Note-for-${releaseNumber}`
                    );
                } catch (e) {
                    return;
                }

                // Return if not
                if (!data || data.status !== 200) return;
            }

            // Setting database
            setRecentRelease(CLIENT_ID, parseInt(releaseNumber));

            // Posting release
            createPost(client, {
                id: parseInt(releaseNumber),
                fancy_title: `Release Notes for ${releaseNumber}`,
                image_url: DEFAULT_IMAGE,
                created_at: new Date().toISOString(),
                category_id: Category.release_notes
            });
        })
        .catch((err) => {
            if (err.response) {
                console.log(
                    `[ForumNotifier] Failed to retrieve release notes - server responded with ${err.response.status}: (${err.response.data})`
                );
            } else if (err.request) {
                console.log(`[ForumNotifier] Failed to retrieve release notes - no response: (${err.request})`);
            } else {
                console.log(`[ForumNotifier] Failed to retrieve release notes - generic error: (${err.message})`);
            }

            // Get new build id
            getNextBuildID(module);

            if (throttleReleases) return;
            throttleReleases = true;

            /* Clear interval */
            clearInterval(releaseIntervalID);
            releaseIntervalID = undefined;
            module.init(client);
            return;
        });
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
        if (forumIntervalID && releaseIntervalID) throw "There is already a subscription for the devforum";

        // Setup roblox updates notifier
        if (!forumIntervalID) {
            const updatesTimer = throttleForum ? 5 * 1000 * 60 : 1 * 1000 * 60; // Throttled: 5 minutes, Regular: 1 minute
            forumIntervalID = setInterval(pollDevforum, updatesTimer, this, client);
            pollDevforum(this, client);
            console.log("[ForumNotifier] Setup Forum Timer");
        }

        // Setup roblox releases notifier
        if (!releaseIntervalID) {
            const releaseTimer = throttleReleases ? 5 * 1000 * 60 : 1 * 1000 * 60; // Throttled: 30 minutes, Regular: 15 minutes
            releaseIntervalID = setInterval(pollReleaseNotes, releaseTimer, this, client);
            pollReleaseNotes(this, client);
            console.log("[ForumNotifier] Setup Release Timer");
        }
    }
}
