import { GuildMember } from "discord.js";
import { QEvent } from "src/utils/events/BaseEvent";
import { PreEvent } from "src/utils/events/PreEvent";
import { updateAccount } from "src/interactions/verification/verify";
import { getGuild } from "src/models/Guild";

export class PreMemberJoin extends PreEvent {
    public constructor() {
        super("guildMemberAdd");
    }

    public async execute(client: QEvent.QClient, member: GuildMember) {
        console.log("%s has joined", member.displayName);

        // Getting joined guild record
        const guild = await getGuild(member.guild.id);
        if (!guild) return false;

        // Attempting to update account
        const didUpdate = await updateAccount(guild, member);
        return didUpdate;
    }
}
