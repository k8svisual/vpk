# VpK (Visually presented Kubernetes)
# Docker build file base image
# FROM node:18.17.1
FROM node:20
LABEL maintainer="k8svisual"

# Create directories
RUN mkdir /vpk
RUN mkdir /vpk/cluster
RUN mkdir /vpk/usage
RUN mkdir /vpk/ssh

# Copy files to container image
WORKDIR /vpk
COPY lib/ ./lib
COPY public/ ./public
COPY package.json .
COPY server.js .
COPY vpkconfig.json .
COPY LICENSE .
COPY README.md .

# Install curl and latest version of kubectl inside image
# and ensure kubectl is executable

RUN apt-get update \ 
    && apt-get install -y  curl \
    && apt-get install -y sshpass \
    && npm install \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \ 
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl

# Add command to start VpK with option to indicate running in container '-c yes'
CMD ["sh", "-c", "node server.js -c yes"]

# Expose the default web port so browser can communicate
EXPOSE 4200/tcp


# MacOS how to get host IP address
# ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -n 1 | awk '{print $2}'

#EXAMPLE docker commands build and tag
#docker build .
#docker build ---- use buildDocker.sh shell ----
#docker tag k8svisual/vpk:6.1.0 k8svisual/vpk:latest

#EXAMPLE docker command to run VpK and map volume and port
#docker run -v /Users/bob/snaptest/:/vpk/cluster -p 4500:4200 k8svisual/vpk
#docker run -e HOST_IP=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -n 1 | awk '{print $2}') -v /Users/bob/snaptest/:/vpk/cluster -v /Users/bob/.ssh:/ssh -p 4500:4200 k8svisual/vpk

#EXAMPLE docker command to open shell
#docker run -it k8svisual/vpk sh