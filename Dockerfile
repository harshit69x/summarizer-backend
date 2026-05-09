FROM node:18-slim

# Install system dependencies for yt-dlp and ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python-is-python3 \
    python3-pip \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Copy and install dev dependencies for build only
COPY package-lock.json ./
RUN npm ci

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Set environment
ENV NODE_ENV=production

# Start app
CMD ["npm", "start"]
