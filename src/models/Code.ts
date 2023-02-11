import { Database } from "src/modules/Database";
import { QClient } from "src/utils/QClient";

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export async function getCode(client: QClient, robloxId: number): Promise<number | null> {
    try {
        const { prisma } = client.modules.get("Database") as Database;

        const entry = await prisma?.code.findUnique({ where: { robloxId } });

        if (entry) {
            if (entry.expiry > new Date()) {
                return entry.code ?? null;
            } else {
                await prisma?.code.delete({ where: { code: entry.code ?? undefined, robloxId } });
            }
        }

        let code = 0;
        while (await prisma?.code.findUnique({ where: { code } })) {
            code = randomInt(100000, 999999);
        }

        const date = new Date();

        date.setMinutes(date.getMinutes() + 10);

        await prisma?.code.create({
            data: {
                robloxId,
                code,
                expiry: date
            }
        });

        return code;
    } catch (err) {
        return null;
    }
}

export async function verifyCode(client: QClient, code: number): Promise<[boolean, string | number]> {
    const { prisma } = client.modules.get("Database") as Database;
    try {
        const entry = await prisma?.code.findUnique({ where: { code } });

        if (entry) {
            try {
                await prisma?.code.delete({ where: { code } });
                return entry.expiry > new Date()
                    ? [true, entry.robloxId]
                    : [false, "Your code has expired! Please generate a new one."];
            } catch (err) {
                return [false, "Failed to verify code, contact a mod!"];
            }
        }
    } catch {
        return [false, "Failed to contact DB, contact a mod!"];
    }

    return [false, "Invalid code!"];
}

/**
 * Deletes codes that have an expiry date before today
 * @returns The number of rows deleted
 */
export async function purgeOldCodes(client: QClient): Promise<number> {
    const { prisma } = client.modules.get("Database") as Database;
    const oldLen = (await prisma?.code.findMany({}))?.length ?? 0;

    await prisma?.code.deleteMany({
        where: {
            expiry: {
                lt: new Date()
            }
        }
    });

    return oldLen - ((await prisma?.code.findMany({}))?.length ?? 0);
}
