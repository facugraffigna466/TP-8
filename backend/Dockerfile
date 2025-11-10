FROM node:20-alpine AS base

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]

