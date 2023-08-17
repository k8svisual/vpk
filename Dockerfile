#FROM mhart/alpine-node:16
FROM node:18.17.1
LABEL maintainer="k8svisual"

RUN mkdir /vpk
RUN mkdir /vpk/cluster
RUN mkdir /vpk/usage
RUN mkdir /vpk/userconfig

WORKDIR /vpk
COPY lib/ ./lib
COPY public/ ./public
COPY LICENSE .
COPY package.json .
COPY server.js .
COPY vpkconfig.json .

#Install kubectl inside image
RUN apt-get install -y  curl \
    && npm install \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \ 
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl  

CMD ["sh", "-c", "node server.js -c yes"]
EXPOSE 4200/tcp

#EXAMPLE docker commands
#docker run -it k8svisual/vpk sh
#docker run -v /Users/bob/snaptest/:/vpk/cluster -v /Users/bob/userconfig/:/vpk/userconfig -p 4500:4200 k8svisual/vpk
#docker tag k8svisual/vpk:5.2.0 k8svisual/vpk:latest