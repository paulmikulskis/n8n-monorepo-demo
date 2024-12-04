# Start from the official Node.js 20 image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install npm and pnpm
RUN npm install -g npm@latest pnpm@8.15.4

# Install n8n globally
RUN npm install -g ape-flows

# Ensure that the `nan` module is available for native add-ons
RUN npm install -g nan

# Copy the entire monorepo from the context directory assuming Docker context is set to monorepo root
COPY . .


# Install dependencies in a way that respects the lock file and avoids updating
RUN pnpm install
RUN pnpm run build -F n8nodes --force
RUN cd apps/n8nodes && npm link

# Expose the port on which n8n will run
EXPOSE 5678

# Copy the startup script
COPY apps/n8nodes/docker-startup.sh /usr/local/bin/startup.sh
RUN chmod +x /usr/local/bin/startup.sh

# Command to run the startup script which handles custom node linking and starts n8n
CMD ["/usr/local/bin/startup.sh"]