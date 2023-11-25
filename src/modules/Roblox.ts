import axios from "axios";
import { EmbedBuilder } from "discord.js";
import { Module } from "../utils/QModule.js";

type UserResponse =
    | {
          description: string;
          created: string;
          isBanned: boolean;
          externalAppDisplayName: string | null;
          hasVerifiedBadge: boolean;
          id: number;
          name: string;
          displayName: string;
      }
    | undefined;

type AvatarResponse =
    | {
          data: {
              targetId: number;
              state: string;
              imageUrl: string;
          }[];
      }
    | undefined;

type DevForumResponse =
    | {
          user: {
              id: number;
              username: string;
              name: string;
              flair_name: string;
              trust_level: Roblox.TrustLevel;
          };
      }
    | undefined;

type HistoryResponse =
    | {
          data: {
              name: string;
          }[];
      }
    | undefined;

type UsernamesResponse =
    | {
          data: {
              id: number;
          }[];
      }
    | undefined;

type Badge =
    | {
          id: number;
          name: string;
          description: string;
          imageUrl: string;
      }
    | undefined;

type PremiumResponse = boolean | undefined;

export class Roblox extends Module {
    public constructor() {
        super({ autoInit: false });
    }

    public async init() {
        return;
    }
}

export namespace Roblox {
    export type User = {
        id: number;
        username: string;
        displayName: string;
        blurb: string;
        joinDate: Date;
        age: number;
        oldNames: string[];
        isBanned: boolean;
        avatar: string;
        trustLevel: TrustLevel | null;
        isStaff: boolean;
        hasPremium: boolean;
    };

    export enum TrustLevel {
        Unknown = -1,
        Visitor = 0,
        Member = 1,
        Regular = 2,
        Editor = 3,
        Leader = 4
    }

    export async function getUser(robloxid: number): Promise<User | null> {
        const urls = [
            axios.get(`https://users.roblox.com/v1/users/${robloxid}`),
            axios.get(
                `https://thumbnails.roblox.com/v1/users/avatar?userIDs=${robloxid}&size=720x720&format=Png&isCircular=false`
            ),
            axios.get(`https://devforum.roblox.com/u/by-external/${robloxid}.json`),
            axios.get(`https://users.roblox.com/v1/users/${robloxid}/username-history?limit=100`),
            axios.get(`https://accountinformation.roblox.com/v1/users/${robloxid}/roblox-badges`),
            axios.get(`https://premiumfeatures.roblox.com/v1/users/${robloxid}/validate-membership`, {
                withCredentials: true,
                headers: {
                    Cookie: `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}` ?? "",
                    "Access-Control-Allow-Origin": "*"
                }
            })
        ];

        const [users, avatar, devforum, namehistory, badges, premium] = await axios.all(urls.map((p) => p.catch((e) => e)));
        const userData: UserResponse = users.data;
        const avatarData: AvatarResponse = avatar.data;
        const devForumData: DevForumResponse = devforum.data;
        const historyData: HistoryResponse = namehistory.data;
        const badgeData: Badge[] = badges.data;
        const premiumData: PremiumResponse = premium.data;

        // Ensuring we have base roblox data
        if (!(avatarData && userData)) return null;
        const date = new Date(userData.created);

        return {
            id: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            blurb: userData.description.length === 0 ? "*This user has no description*" : userData.description,
            joinDate: date,
            age: Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)),
            isBanned: userData.isBanned,
            avatar: avatarData?.data[0].imageUrl,
            oldNames: historyData?.data.map((nameObject) => nameObject.name) || [],
            trustLevel: devForumData?.user.trust_level ?? TrustLevel.Unknown,
            isStaff: badgeData.some((badge) => badge?.id === 1),
            hasPremium: premiumData || false
        } as User;
    }

    export async function getUserByName(username: string): Promise<User | null> {
        return await axios
            .post("https://users.roblox.com/v1/usernames/users", {
                usernames: [username]
            })
            .then(async (users) => {
                const userData: UsernamesResponse = users.data;

                if (!userData || userData.data.length !== 1) return null;

                return await getUser(userData.data[0].id);
            })
            .catch(() => {
                return null;
            });
    }

    export function generateEmbed(user: User): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(user.displayName === user.username ? `${user.username}` : `${user.displayName} (${user.username})`)
            .setDescription(user.blurb)
            .setThumbnail(user.avatar)
            .setURL(`https://www.roblox.com/users/${user.id}`)
            .setFields(
                { name: "Account Age", value: `${user.age}`, inline: true },
                { name: "Created", value: `<t:${Math.floor(user.joinDate.getTime() / 1000)}:f>`, inline: true }
            )
            .setColor(0x545fa9);

        if (user.oldNames.length !== 0) {
            embed.addFields({ name: "Old Names", value: user.oldNames.join(", "), inline: true });
        }

        if (user.trustLevel !== TrustLevel.Unknown) {
            embed.addFields({ name: "Trust Level", value: `${TrustLevel[user.trustLevel!]}`, inline: true });
        }

        if (user.isStaff) {
            embed.addFields({ name: "Is Roblox Staff?", value: "Yes" });
        }

        if (user.hasPremium) {
            embed.addFields({ name: "Has Premium?", value: "Yes" });
        }

        if (user.isBanned) {
            embed.addFields({ name: "Is Banned?", value: "Yes" });
        }

        return embed;
    }
}
