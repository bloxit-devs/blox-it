import { Message } from "discord.js";
import { PreEvent } from "../utils/events/PreEvent.js";
import { QEvent } from "../utils/events/BaseEvent.js";

export class PreMessageCreate extends PreEvent {
    public constructor() {
        super("messageCreate");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public execute(client: QEvent.QClient, message: Message) {
        return;
    }
}
