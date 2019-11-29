FROM node:12-alpine

WORKDIR /impresso-middle-layer

COPY ./package.json .
COPY ./package-lock.json .
RUN npm install --production

COPY . .

RUN mkdir -p config
COPY ./config/default.json ./config

ENTRYPOINT [ "node", "./src" ]
