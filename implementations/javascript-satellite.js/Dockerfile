FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Use existing node user (UID 1000 in node:18-slim)
RUN chown -R node:node /app

USER node

# Entrypoint
ENTRYPOINT ["node", "src/index.js"]
CMD []
