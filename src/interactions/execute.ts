import { ContextMenuCommandBuilder, ApplicationCommandType, codeBlock, escapeCodeBlock } from "discord.js";
import { QInteraction } from "../utils/QInteraction.js";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { temporaryWriteTask } from "tempy";
import { fileURLToPath } from "node:url";
import pidusage from "pidusage";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class execute extends QInteraction {
    public constructor() {
        super(new ContextMenuCommandBuilder().setType(ApplicationCommandType.Message).setName("Execute Luau"));
    }

    public async execute(client: QInteraction.Client, interaction: QInteraction.MessageContext) {
        await interaction.deferReply();

        const rawCode = interaction.targetMessage.content;
        const code = /```(?:([\w-]+)\n)?([\s\S]*?)```/gm.exec(rawCode)?.[2] ?? rawCode;

        await temporaryWriteTask(
            code,
            async (filePath) => {
                const cancelSignal = new AbortController();

                const subprocess = execa(`./luau`, [filePath], {
                    timeout: 2_500 /* 2.5s timeout, in case of stuff like while true do loops etc */,
                    cwd: join(__dirname, "..", "utils", "languages", "luau"),
                    signal: cancelSignal.signal
                });

                // https://github.com/sindresorhus/execa/issues/205#issuecomment-484235713
                const maxRAMBytes = 16 * 1000000;

                const ramMonitorInterval = setInterval(ramMonitor, 100);
                async function ramMonitor() {
                    try {
                        const { memory } = await pidusage(subprocess.pid!);
                        if (memory > maxRAMBytes) {
                            clearInterval(ramMonitorInterval);
                            cancelSignal.abort("Out of memory");
                        }
                    } catch {
                        /* empty */
                    }
                }

                const { stdout, stderr } = await subprocess.catch((e) =>
                    e.isCanceled ? { ...e, stderr: "Out of memory" } : e
                );
                clearInterval(ramMonitorInterval);

                let string = "";
                if (stdout) string += `📝 Logs:\n${escapeCodeBlock(stdout)}\n`;
                if (stderr) string += `❌ Errors:\n${escapeCodeBlock(stderr)}\n`;

                await interaction.editReply({
                    content: codeBlock(string.substring(0, 1992 /* 2000 (max length) - 8 (the length of ```\n\n```) */)),
                    allowedMentions: {
                        parse: []
                    }
                });
            },
            { extension: ".luau" }
        );
    }
}
