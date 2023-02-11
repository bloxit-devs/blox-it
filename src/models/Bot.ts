import { Database } from "src/modules/Database";
import { QClient } from "src/utils/QClient";

export async function getRecentRelease(client: QClient, clientId: string): Promise<number | null> {
    const { prisma } = client.modules.get("Database") as Database;
    try {
        const entry = await prisma?.bot.findUnique({ where: { clientId } });
        return entry?.recentRelease ?? 9999;
    } catch (err) {
        return null;
    }
}

export async function setRecentRelease(client: QClient, clientId: string, release: number) {
    const { prisma } = client.modules.get("Database") as Database;
    try {
        if (!(await prisma?.bot.findUnique({ where: { clientId } }))) {
            await prisma?.bot.create({
                data: {
                    clientId,
                    recentRelease: release
                }
            });
            return true;
        }

        prisma?.bot.update({
            where: {
                clientId
            },
            data: {
                recentRelease: release
            }
        });

        return true;
    } catch (err) {
        return null;
    }
}
