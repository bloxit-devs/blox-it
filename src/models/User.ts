import { Database } from "src/modules/Database";
import { QClient } from "src/utils/QClient";

export async function checkBanned(client: QClient, robloxId: number): Promise<boolean> {
    try {
        const { prisma } = client.modules.get("Database") as Database;
        const user = await prisma?.user.findUnique({ where: { robloxId } });
        return user?.banned ?? false;
    } catch {
        return false;
    }
}

export async function linkAccount(client: QClient, discordId: string, robloxId: number): Promise<boolean> {
    try {
        const { prisma } = client.modules.get("Database") as Database;

        if (!(await prisma?.user.findUnique({ where: { discordId } }))) {
            prisma?.user.create({
                data: {
                    discordId,
                    robloxId
                }
            });
            return true;
        }

        prisma?.user.update({
            where: {
                discordId
            },
            data: {
                robloxId
            }
        });

        return true;
    } catch (err) {
        return false;
    }
}

export async function unlinkAccount(client: QClient, discordId: string): Promise<boolean> {
    try {
        const { prisma } = client.modules.get("Database") as Database;
        await prisma?.user.delete({ where: { discordId } });

        return true;
    } catch (err) {
        return false;
    }
}

export async function getRobloxID(client: QClient, discordId: string): Promise<number | null> {
    try {
        const { prisma } = client.modules.get("Database") as Database;
        const user = await prisma?.user.findUnique({ where: { discordId } });

        return user?.robloxId ?? null;
    } catch (err) {
        return null;
    }
}
