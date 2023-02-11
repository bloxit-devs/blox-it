import { Guild } from "@prisma/client";
import { Database } from "src/modules/Database";
import { QClient } from "src/utils/QClient";

/**
 * The role type for certain event based pings
 */
export type RoleType = "allRole" | "updateRole" | "releaseRole";
/**
 * The channel type for certain notifications
 */
export type NotifyChannel = "robloxUpdates" | "robloxReleases";

export type VerificationSettings = Pick<
    Guild,
    "verifyEnabled" | "verifyEmbedId" | "verifiedRole" | "devMemberRole" | "devRegularRole" | "robloxStaffRole"
>;

export async function getGuild(client: QClient, guildId: string): Promise<Guild | null> {
    try {
        const { prisma } = client.modules.get("Database") as Database;
        const guild = await prisma?.guild.findUnique({
            where: { guildId }
        });

        if (!guild) return prisma?.guild.create({ data: { guildId } }) ?? null;

        return guild;
    } catch (err) {
        return null;
    }
}

/**
 * Searches the guild table for guilds with atleast one notify channel
 * @returns A table of valId guilds
 */
export async function getGuildChannels(client: QClient): Promise<Guild[]> {
    const { prisma } = client.modules.get("Database") as Database;

    return (
        prisma?.guild.findMany({
            where: {
                OR: {
                    robloxUpdates: null,
                    robloxReleases: null
                }
            }
        }) ?? []
    );
}

/**
 * Sets the notifier channels for the specified guild
 * @param guildId The target guild Id
 * @param channelType The type of the channel for the channel id
 * @param channelId The channel id
 */
export async function setNotifyChannels(
    client: QClient,
    guildId: string,
    channelType: NotifyChannel,
    channelId: string | null
) {
    const { prisma } = client.modules.get("Database") as Database;

    try {
        if (!(await prisma?.guild.findUnique({ where: { guildId } }))) {
            await prisma?.guild.create({
                data: {
                    guildId,
                    [channelType]: channelId
                }
            });
            return true;
        }

        await prisma?.guild.update({
            where: {
                guildId
            },
            data: {
                [channelType]: channelId
            }
        });
    } catch (err) {
        return false;
    }

    return true;
}

/**
 *
 * @param guildId
 * @param roleType
 * @param role
 */
export async function setNotifyRoles(
    client: QClient,
    guildId: string,
    roleType: "allRole" | "updateRole" | "releaseRole",
    roleId: string | null
) {
    const { prisma } = client.modules.get("Database") as Database;

    try {
        if (!(await prisma?.guild.findUnique({ where: { guildId } }))) {
            await prisma?.guild.create({
                data: {
                    guildId,
                    [roleType]: roleId
                }
            });
            return true;
        }

        await prisma?.guild.update({
            where: {
                guildId
            },
            data: {
                [roleType]: roleId
            }
        });
    } catch (err) {
        return false;
    }

    return true;
}

export async function updateVerifySettings(client: QClient, guildId: string, data: VerificationSettings) {
    const { prisma } = client.modules.get("Database") as Database;
    if (Object.keys(data).length === 0) return true;

    try {
        if (!(await prisma?.guild.findUnique({ where: { guildId } }))) {
            await prisma?.guild.create({
                data: {
                    guildId,
                    ...data
                }
            });
            return true;
        }

        await prisma?.guild.update({ where: { guildId }, data });
    } catch (err) {
        return false;
    }

    return true;
}
