# Use an official Node runtime as the base image
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and pnpm-lock.yaml (if available)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy specific directories and files
COPY src ./src
COPY tsconfig.json ./

# Set environment variables
ENV PORT=3000
ENV SOLANA_NETWORK=mainnet-beta

# Build your TypeScript code
RUN pnpm run build

# Expose the port your app runs on
EXPOSE 3000

# Define the command to run your app
CMD ["node", "dist/index.js"]