# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Install expo-cli
RUN npm install -g expo-cli

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Build the web app
RUN npx expo export

# Install a simple web server to serve the built files
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 8081

# Command to run the app
CMD ["serve", "-s", "dist", "-l", "8081"]
