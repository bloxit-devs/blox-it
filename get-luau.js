// @ts-check
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type } from "node:os";
import { default as axios } from "axios";
import { fromBuffer } from "yauzl-promise";
import { pipeline } from "node:stream/promises";

const osType = type().toLowerCase();
const os = osType === "windows_nt" ? "windows" : osType === "darwin" ? "macos" : "ubuntu";

const luauDir = join("dist", "utils", "languages", "luau");

if (!existsSync(luauDir)) {
    mkdirSync(luauDir, { recursive: true });
}

const exeStream = createWriteStream(join(luauDir, `luau${os === "windows" ? ".exe" : ""}`));
const filenameRegex = /^luau(\.exe)?$/m;

axios
    .get(`https://github.com/luau-lang/luau/releases/latest/download/luau-${os}.zip`, { responseType: "arraybuffer" })
    .then((r) => fromBuffer(r.data))
    .then(async (zip) => {
        for await (const entry of zip) {
            if (filenameRegex.test(entry.filename)) {
                await pipeline(await entry.openReadStream(), exeStream);
                break;
            }
        }
    });
