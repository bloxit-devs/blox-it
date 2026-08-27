FROM node:22-alpine AS build

# Install requirements for node-gyp
RUN apk add --no-cache python3 make g++

# Prepare packages
WORKDIR /usr/bot/
COPY ["package.json", "yarn.lock", "./"]
RUN yarn install

# Build
COPY . .
RUN yarn run build

#########
# Runtime
FROM node:22-alpine AS runtime

# Install sqlite
RUN apk add --no-cache sqlite

# Prepare area
WORKDIR /usr/bot
RUN mkdir ./data && chown -R 1000 ./data

# Copy build files
COPY package.json
COPY --from=build --chown=1000 /usr/bot/dist ./
COPY --from=build --chown=1000 /usr/bot/node_modules ./node_modules

# Non-root node user
USER 1000

# Execute
ENV NODE_ENV=production
CMD ["node", "bot.js"]
