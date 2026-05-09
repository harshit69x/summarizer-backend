FROM node:18-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY . .

COPY package-lock.json ./
RUN npm ci

RUN npm run build

RUN npm prune --production

ENV NODE_ENV=production

CMD ["npm", "start"]
