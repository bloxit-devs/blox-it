import { Table, Column, Model, Unique, AllowNull, DataType, PrimaryKey, Default } from "sequelize-typescript";
import { Op } from "sequelize";

/**
 * The role type for certain event based pings
 */
export type roleType = "allRole" | "updateRole" | "releaseRole";
/**
 * The channel type for certain notifications
 */
export type notifyChannel = "rbxUpdates" | "rbxReleases";

export type VerificationSettings = {
    verifyEnabled?: boolean;
    verifyEmbedID?: string | null;
    verifiedRole?: string | null;
    devMemberRole?: string | null;
    devRegularRole?: string | null;
    rbxStaffRole?: string | null;
};

@Table({
    timestamps: false
})
export class Guild extends Model {
    @Unique
    @PrimaryKey
    @Column(DataType.STRING)
    declare guildID: string;

    /* Devforum Notifier */
    @AllowNull
    @Column(DataType.STRING)
    declare rbxUpdates?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare rbxReleases?: string | null;

    /* Reaction Roles */
    @AllowNull
    @Column(DataType.STRING)
    declare allRole?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare updateRole?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare releaseRole?: string | null;

    /* Verification System */
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare verifyEnabled?: boolean;

    @AllowNull
    @Column(DataType.STRING)
    declare verifyEmbedID?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare verifiedRole?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare devMemberRole?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare devRegularRole?: string | null;

    @AllowNull
    @Column(DataType.STRING)
    declare rbxStaffRole?: string | null;
}

export async function getGuild(guildID: string | number): Promise<Guild | null> {
    try {
        const [guild] = await Guild.findOrCreate({
            where: { guildID: guildID.toString() }
        });

        return guild;
    } catch (err) {
        return null;
    }
}

/**
 * Searches the guild table for guilds with atleast one notify channel
 * @returns A table of valid guilds
 */
export async function getGuildChannels(): Promise<Guild[]> {
    return Guild.findAll({
        where: {
            [Op.or]: {
                rbxUpdates: { [Op.ne]: null },
                rbxReleases: { [Op.ne]: null }
            }
        }
    });
}

/**
 * Sets the notifier channels for the specified guild
 * @param guildID The target guild ID
 * @param rbxUpdates The roblox update channel ID
 * @param rbxReleases The roblox release channel ID
 */
export async function setNotifyChannels(guildID: string | number, channelType: notifyChannel, channelID: string | null) {
    const [guild] = await Guild.findOrCreate({
        where: { guildID: guildID.toString() }
    });

    // Setting role
    guild[channelType] = channelID;

    try {
        await guild.save();
    } catch (err) {
        return false;
    }

    return true;
}

/**
 *
 * @param guildID
 * @param roleType
 * @param role
 */
export async function setNotifyRoles(
    guildID: string | number,
    roleType: "allRole" | "updateRole" | "releaseRole",
    role: string | null
) {
    const [guild] = await Guild.findOrCreate({
        where: { guildID: guildID.toString() }
    });

    // Setting role
    guild[roleType] = role;

    try {
        await guild.save();
    } catch (err) {
        return false;
    }

    return true;
}

export async function updateVerifySettings(guildID: string | number, data: VerificationSettings) {
    if (Object.keys(data).length === 0) return true;

    try {
        await Guild.findOrCreate({
            where: { guildID: guildID.toString() }
        });

        await Guild.update(data, { where: { guildID: guildID } });
    } catch (err) {
        return false;
    }

    return true;
}
