FROM node:20-alpine as builder

WORKDIR /impresso-middle-layer

COPY package-lock.json package.json tsconfig.json ./

RUN npm install

FROM node:20-alpine as runner

ARG GIT_TAG
ARG GIT_BRANCH
ARG GIT_REVISION

WORKDIR /impresso-middle-layer

COPY package-lock.json package.json tsconfig.json ./

COPY --from=builder /impresso-middle-layer/node_modules/ ./node_modules/

COPY src ./src

COPY public ./public

RUN mkdir -p config
COPY ./config/default.json ./config

ENV GIT_TAG=${GIT_TAG}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV GIT_REVISION=${GIT_REVISION}

ENTRYPOINT [ "./node_modules/.bin/tsx", "./src/index.ts" ]
