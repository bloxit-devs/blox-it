import { Table, Column, Model, Unique, AllowNull, DataType } from "sequelize-typescript";
import { Op } from "sequelize";

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

@Table({
    timestamps: false
})
export class Code extends Model {
    @Unique
    @Column(DataType.INTEGER)
    declare robloxID: number;

    @Unique
    @AllowNull
    @Column(DataType.INTEGER)
    declare code?: number;

    @Unique
    @AllowNull
    @Column(DataType.STRING)
    declare phrase?: string;

    @Column(DataType.DATE)
    declare expiry: Date;
}

export async function getCode(rbxID: number): Promise<number | null> {
    try {
        const entry = await Code.findOne({ where: { robloxID: rbxID } });

        if (entry) {
            if (entry.expiry > new Date()) {
                return entry.code || null;
            } else {
                await entry.destroy();
            }
        }

        let done = false;
        let code = 0;
        while (!done) {
            code = randomInt(100000, 999999);
            if (!(await Code.findOne({ where: { code: code } }))) {
                done = true;
            }
        }

        const date = new Date();
        date.setMinutes(date.getMinutes() + 10);
        await Code.create({
            robloxID: rbxID,
            code: code,
            expiry: date
        });

        return code;
    } catch (err) {
        return null;
    }
}

export async function verifyCode(code: number): Promise<[boolean, string | number]> {
    const entry = (await Code.findOne({ where: { code: code } }).catch(() => {
        return [false, "Failed to contact DB, contact a mod!"];
    })) as Code;

    if (entry) {
        try {
            if (entry.expiry > new Date()) {
                const userid = entry.robloxID;
                await entry.destroy();
                return [true, userid];
            } else {
                await entry.destroy();
                return [false, "Your code has expired! Please generate a new one."];
            }
        } catch (err) {
            return [false, "Failed to verify code, contact a mod!"];
        }
    }

    return [false, "Invalid code!"];
}

/**
 * Deletes codes that have an expiry date before today
 * @returns The number of rows deleted
 */
export async function purgeOldCodes(): Promise<number> {
    const oldLen = Code.length;
    await Code.destroy({
        where: {
            expiry: {
                [Op.lt]: new Date()
            }
        }
    });
    return oldLen - Code.length;
}
