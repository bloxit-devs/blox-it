// Implementation: https://github.com/daimond113/exectr-bot
import { ContextMenuCommandBuilder, ApplicationCommandType, codeBlock } from "discord.js";
import { QInteraction } from "../utils/QInteraction";
import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import getStream from "get-stream";

type ClosedChildProcess = Pick<ChildProcess, "exitCode" | "signalCode"> & {
    stdoutEncoded: string;
    stderrEncoded: string;
};

async function childClose(child: ChildProcess): Promise<ClosedChildProcess> {
    const [, stdoutEncoded, stderrEncoded] = await Promise.all([
        once(child, "close"),
        getStream(child.stdout ?? new PassThrough()),
        getStream(child.stderr ?? new PassThrough())
    ]);
    return {
        ...child,
        stdoutEncoded: stdoutEncoded as string,
        stderrEncoded: stderrEncoded as string
    };
}

export class execute extends QInteraction {
    public constructor() {
        super(new ContextMenuCommandBuilder().setType(ApplicationCommandType.Message).setName("Execute Luau"));
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.MessageContext) {
        await interaction.deferReply();
        const rawCode = interaction.targetMessage.content;
        const code = /```(?:([\w-]+)\n)?([\s\S]*?)```/gm.exec(rawCode)?.[2] ?? rawCode;
        const child = fork(join(__dirname, "..", "languages", "luau.js"), [code], {
            silent: true
        });
        const { stdoutEncoded, stderrEncoded } = await childClose(child);

        let string = "";
        if (stdoutEncoded) string += `📝 Logs:\n${stdoutEncoded}\n`;
        if (stderrEncoded) string += `❌ Errors:\n${stderrEncoded}\n`;
        interaction.editReply({
            content: codeBlock(string),
            allowedMentions: {
                parse: []
            }
        });
    }
}
