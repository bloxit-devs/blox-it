import { Table, Column, Model, Unique, AllowNull, DataType } from "sequelize-typescript";

@Table({
    timestamps: false
})
export class Bot extends Model {
    @Unique
    @Column(DataType.STRING)
    clientID!: string;

    @Unique
    @AllowNull
    @Column(DataType.INTEGER)
    recentRelease?: number;
}

export async function getRecentRelease(clientID: string): Promise<number | null> {
    try {
        const entry = await Bot.findOne({ where: { clientID: clientID } });
        return entry?.recentRelease ?? 9999;
    } catch (err) {
        return null;
    }
}

export async function setRecentRelease(clientID: string, release: number) {
    try {
        const [entry] = await Bot.findOrCreate({ where: { clientID: clientID } });

        entry.recentRelease = release;
        await entry.save();

        return true;
    } catch (err) {
        return null;
    }
}
