// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */
const { createWriteStream } = require("node:fs");
const { join } = require("node:path");
const { default: axios } = require("axios");

const luauPath = join(process.cwd(), "dist", "luau.js");

const stream = createWriteStream(luauPath);

axios
    .get("https://github.com/Roblox/luau/releases/latest/download/Luau.Web.js", { responseType: "stream" })
    .then((r) => r.data.pipe(stream));
