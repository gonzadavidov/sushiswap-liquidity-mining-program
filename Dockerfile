FROM node:lts-alpine
ENV NODE_ENV=production

COPY "package.json" ./
COPY "package-lock.json*" ./
COPY . .

RUN npm ci --quiet
USER node
