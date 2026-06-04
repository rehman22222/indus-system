FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Start server
CMD ["node", "src/server.js"]
