FROM node:lts-alpine AS build

WORKDIR /src
COPY ./package* ./

RUN npm ci --only production

FROM node:lts-alpine

WORKDIR /usr/src/service

COPY --from=build /src/node_modules node_modules
COPY server.js server.js

USER node

ENV NODE_ENV=production

CMD ["node", "./server.js"]
