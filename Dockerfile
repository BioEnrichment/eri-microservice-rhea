
FROM node:8.12.0-alpine

RUN apk add git python make g++ && \
    mkdir /opt/nodeapp && \
    chown node:node /opt/nodeapp

USER node

COPY package.json /opt/nodeapp
RUN cd /opt/nodeapp && npm install

COPY lib /opt/nodeapp/lib
WORKDIR /opt/nodeapp

CMD npm start


