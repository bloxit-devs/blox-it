import { GuildMember } from "discord.js";
import { QEvent } from "../utils/events/BaseEvent";
import { PreEvent } from "../utils/events/PreEvent";
import { updateAccount } from "../interactions/verification/verify";
import { getGuild } from "../models/Guild";

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
