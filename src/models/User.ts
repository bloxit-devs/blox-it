import { Table, Column, Model, Unique, AllowNull, DataType, Default } from "sequelize-typescript";

@Table({
    timestamps: false
})
export class User extends Model {
    @Unique
    @Column(DataType.STRING)
    discordID!: string;

    @Unique
    @AllowNull
    @Column(DataType.INTEGER)
    robloxID?: number;

    @Default(false)
    @Column(DataType.BOOLEAN)
    banned?: boolean;
}

export function checkBanned(rbxID: number): boolean {
    User.findOne({ where: { robloxID: rbxID } })
        .then((user) => {
            return (user && user.banned) || false;
        })
        .catch(() => {
            return false;
        });

    return false;
}

export async function linkAccount(discordID: string, rbxID: number): Promise<boolean> {
    try {
        const [user] = await User.findOrCreate({ where: { discordID: discordID } });

        user.robloxID = rbxID;
        await user.save();

        return true;
    } catch (err) {
        return false;
    }
}

export async function unlinkAccount(discordID: string): Promise<boolean> {
    try {
        const user = await User.findOne({ where: { discordID: discordID } });

        await user?.destroy();

        return true;
    } catch (err) {
        return false;
    }
}

export async function getRobloxID(discordID: string): Promise<number | null> {
    try {
        const user = await User.findOne({ where: { discordID: discordID } });

        return user?.robloxID ?? null;
    } catch (err) {
        return null;
    }
}
