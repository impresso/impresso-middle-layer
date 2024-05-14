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

RUN npm run build
RUN npm run copy-files
RUN ls -la ./dist

COPY public ./public
COPY scripts ./scripts

RUN mkdir -p config
COPY ./config/default.json ./config

ENV IMPRESSO_GIT_TAG=${GIT_TAG}
ENV IMPRESSO_GIT_BRANCH=${GIT_BRANCH}
ENV IMPRESSO_GIT_REVISION=${GIT_REVISION}

ENTRYPOINT [ "node", "./dist" ]
