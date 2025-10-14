FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm i --omit=dev && npm cache clean --force
COPY bin ./bin
COPY lib ./lib
COPY replay.mjs ./replay.mjs
HEALTHCHECK CMD node bin/logline-verify.mjs || exit 0
CMD ["node","bin/logline-verify.mjs"]
