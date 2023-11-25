import { GuildMember } from "discord.js";
import { QEvent } from "../utils/events/BaseEvent.js";
import { PreEvent } from "../utils/events/PreEvent.js";
import { updateAccount } from "../interactions/verification/verify.js";
import { getGuild } from "../models/Guild.js";

export class PreMemberJoin extends PreEvent {
    public constructor() {
        super("guildMemberAdd");
    }

    public async execute(client: QEvent.QClient, member: GuildMember) {
        // Getting joined guild record
        const guild = await getGuild(member.guild.id);
        if (!guild) return false;

        // Attempting to update account
        const didUpdate = await updateAccount(guild, member);
        return didUpdate;
    }
}
