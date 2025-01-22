# Use the official Node.js LTS version as the base image
FROM node:16-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker's caching mechanism
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the application port (change this if your app uses a different port)
EXPOSE 3000

# Set environment variables for production (optional)
ENV NODE_ENV=production

# Command to start the application
CMD ["node", "server.js"]
