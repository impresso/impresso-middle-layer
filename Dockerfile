FROM node:12-alpine

ARG GIT_BRANCH
ARG GIT_REVISION

WORKDIR /impresso-middle-layer

COPY ./package.json .
COPY ./package-lock.json .
RUN npm install --production

COPY public ./public
COPY scripts ./scripts
COPY src ./src

RUN mkdir -p config
COPY ./config/default.json ./config

ENV IMPRESSO_GIT_BRANCH=${GIT_BRANCH}
ENV IMPRESSO_GIT_REVISION=${GIT_REVISION}

ENTRYPOINT [ "node", "./src" ]
