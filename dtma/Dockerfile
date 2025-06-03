# Stage 1: Build the application
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install dependencies
# Copy package.json and package-lock.json (or npm-shrinkwrap.json) 
COPY package*.json ./

# Install dependencies using npm install (since we added new dependencies)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Stage 2: Production image
FROM node:20-slim

WORKDIR /usr/src/app

# Only copy necessary artifacts from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

# Expose the port the app runs on (default 30000 to match Agentopia expectations)
ENV PORT=30000
EXPOSE ${PORT}

# Environment variables that need to be provided at runtime
ENV DTMA_BEARER_TOKEN=""
ENV AGENTOPIA_API_BASE_URL=""
ENV BACKEND_TO_DTMA_API_KEY=""
# Optional: For Node.js environment
ENV NODE_ENV=production

# Command to run the application
# Assuming 'npm start' script is defined in package.json as 'node dist/index.js'
CMD [ "npm", "start" ] 