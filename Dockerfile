#FROM mhart/alpine-node:16
FROM node:18.10.0
LABEL maintainer="k8debug"

RUN mkdir /vpk
RUN mkdir /vpk/cluster
RUN mkdir /vpk/usage
RUN mkdir /vpk/userconfig

WORKDIR /vpk
COPY lib/ ./lib
COPY public/ ./public
COPY userconfig/ ./userconfig
COPY server.js .
COPY vpkconfig.json .
COPY package.json .
COPY LICENSE .

RUN apt-get install -y  curl \
    && npm install \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \ 
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl  

CMD ["sh", "-c", "node server.js -c yes"]
EXPOSE 4200/tcp

#docker run -it k8debug/vpk sh
#docker run -v /Users/bob/snaptest/:/vpk/cluster -v /Users/bob/userconfig/:/vpk/userconfig -p 4500:4200 k8debug/vpk
#docker tag k8debug/vpk:5.2.0 k8debug/vpk:latest