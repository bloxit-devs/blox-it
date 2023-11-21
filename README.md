# Blox-it
The official bot for Blox-it. Built upon a customised command/events framework for discord.js and expanded upon to include additional useful features.
This is the second iteration of the Blox-it bot for support with Discord.js@14 and maintainability.

[Blox-it Discord](https://discord.gg/55unjzE4dU)

## Setup

### Installation
This project was setup using yarn, it should be as simple as running `yarn install` but there may be an issue with `node-gyp` as we are using node packages which require this build step.
Ensure you have python3 installed and visual studio build tools for node-gyp to work, if you recieve an error there is a link to their github for more information.

### Building
1. Copy the .env.example file into a .env file and update the parameters to suit your needs,
2. Run `yarn dev` for a 'dev' version of the bot. The dev version will deploy the interactions to the 'dev guild' which prevents caching issues with global deployments
3. Once you are happy run `yarn build` to build the typescript to js files and then `yarn start (I recommend using pm2 for this)

## Features
- [x] Expandable Events Framework
- [x] Exapandable Interaction Framework
- [x] Roblox Verification
- [x] Devforum Updates Notifier
- [x] Release Notes notifier
- [ ] Roblox status notifier ([#20](https://github.com/bloxit-devs/blox-it/pull/20))
