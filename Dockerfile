# VpK (Visually presented Kubernetes)
# Docker build file base image
FROM node:23.11-slim AS builder
LABEL maintainer="k8svisual"

# Declare build-time architecture
ARG TARGETARCH

# Create directories
RUN mkdir /vpk
RUN mkdir /vpk/cluster
RUN mkdir /vpk/usage

# Copy files to container image
WORKDIR /vpk
COPY dist/ ./dist
COPY package.json .
COPY vpkconfig.json .
COPY LICENSE .
COPY README.md .

# Install app packages
# Install curl 
# Install latest version of kubectl inside image and ensure kubectl is executable
RUN apt-get update \
    && apt-get install -y curl ca-certificates sshpass gnupg \
    && npm install --omit=dev \
    && ARCH_SUFFIX="$TARGETARCH" \
    && KUBECTL_VERSION="$(curl -sSL https://dl.k8s.io/release/stable.txt)" \
    && curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH_SUFFIX}/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add command to start VpK with option to indicate running in container '-c yes'
CMD ["sh", "-c", "node dist/server/server.js -c yes"]

# Expose the default web port so browser can communicate
EXPOSE 4200/tcp


# MacOS how to get host IP address
# ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -n 1 | awk '{print $2}'

#EXAMPLE docker commands build and tag
#docker build .
#docker build ---- use buildDocker.sh shell ----
#docker tag k8svisual/vpk:latest  k8svisual/vpk:6.1.0
#docker push k8svisual/vpk:6.1.0

#EXAMPLE docker command to run VpK and map volume and port
#docker run -v /Users/bob/snaptest/:/vpk/cluster -p 4500:4200 k8svisual/vpk

#EXAMPLE docker command to open shell via exec
# docker ps
# copy k8svisual/vpk CONTAINER ID to clip board
#docker exec -it (paste Container ID) sh

#EXAMPLE docker command to run command in vpk container
#docker run -it k8svisual/vpk sh

#======================= Multi-platform docker images =========================
#
# List existing builds
#
#    docker buildx ls
#
# Create a New Builder Instance:
# Docker buildx operates with the concept of "builders", which are essentially 
# environments where the build process runs. Create a new builder instance 
# which has support for multi-architecture builds:
#
#    docker buildx create --name mybuilder --use
#
# Start up the Builder: 
# After creating a builder, you need to start it:
#
#    docker buildx inspect --bootstrap
#
# Build the image:
# Now, use the docker buildx build command to build the image for multiple 
# architectures. You need to specify each architecture with the --platform 
# flag. For example, to build for arm64 and amd64:
#
#    docker buildx build --platform linux/amd64,linux/arm64 -t k8svisual/vpk:latest . --push
#
# Verify the Image:
#
#    docker manifest inspect k8svisual/vpk:latest
#
#
