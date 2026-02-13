# Dockerfile for Blockchain Listener Service
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm install -g ts-node typescript

# Copy necessary source files
COPY services/ ./services/
COPY prisma/ ./prisma/
COPY src/lib/prisma.ts ./src/lib/prisma.ts

# Generate Prisma Client
RUN npx prisma generate

# Expose health check port (optional)
EXPOSE 3001

# Run the listener service
CMD ["ts-node", "services/blockchain-listener.ts"]
