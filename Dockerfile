# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 3000, so you'll use the 'PORT' environment variable
# to tell the app which port to listen on
ENV NODE_ENV production
ENV PORT 8080
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "start" ]
