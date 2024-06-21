# impresso-middle-layer

Internal API for the impresso web application and public API.

```shell
git clone impresso-middle-layer
cd path/to/impresso-middle-layer && npm install

# Watch and compile/copy files in one terminal:
npm run watch

# Run the frontend app in another terminal with the following env variables:
make run-dev
# or
VUE_APP_MIDDLELAYER_API_PATH=/ VUE_APP_MIDDLELAYER_API=http://localhost:3030 VUE_APP_MIDDLELAYER_API_SOCKET_PATH=/socket.io make run-dev 
```

## About

This project uses [Feathers](http://feathersjs.com). An open source web framework for building modern real-time applications.
We also use: SolR, mysql, neo4j, redis.

This project contains code for both the internal API and the public API. The internal API is used by the impresso web application, while the public API is used by third party clients. The internal API is enabled by default. To enable the public API, set the configuration flag in the [config file](config/default.json) `isPublicApi` to `true`.

The Public API exposes a Swagger page at `/docs` URL.

## Getting started using docker development stack

There is a docker-compose.yml that helps in starting up redis and mysql (via tunneling in our case, local port `3306`)

Create a `./docker/config/ssh/config` file:

```
    Host cli-mysql-tunnel
    HostName      host_secret
    User          host_user
    Port          host_port
    IdentityFile  /root/.ssh/your-key
    LocalForward  *:3306 127.0.0.1:3306
    ServerAliveInterval 30
    ServerAliveCountMax 3
```

Add relevant ssh key relative to the mapped folder `/root/.ssh` in `kroniak/ssh-client` docker image, then:

```
docker-compose up
```

Then:

```
make run-dev
```

## Getting Started using

Getting up and running is as easy as 1, 2, 3, 4, 5.

1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
1. Install your dependencies

   ```
   git clone impresso-middle-layer
   cd path/to/impresso-middle-layer && npm install
   ```

1. Check that [redis](https://redis.io) is running.
1. (optionally) configure your mysql tunnelling, e.g. in with config stored in `~/.ssh/config`:

   ```
   Host cli-mysql-tunnel
   HostName      host_secret
   User          host_user
   Port          host_port
   IdentityFile  /path/to/private/key
   LocalForward  3307 127.0.0.1:3306
   ServerAliveInterval 30
   ServerAliveCountMax 3
   ```

   then run the tunnelling with autossh (note the name `cli-mysql-tunnel`)

   ```
   nohup autossh -M 0 -T -N cli-mysql-tunnel &
   ```

   ref. [SSH TUNNELLING FOR FUN AND PROFIT: AUTOSSH](https://www.everythingcli.org/ssh-tunnelling-for-fun-and-profit-autossh/)

   ```
   /usr/bin/autossh -M 0 -o "ServerAliveInterval 30" -o "ServerAliveCountMax 3" -NL 3307:localhost:3306 <host_user>@<host_name> -p <host_port> -i /path/to/private/key
   ```

   You can also create a **service** using system d.

1. Configure the `config/development.json` and `config/production.json` according to your system settings
1. Preload the list of Newspaper and of the Topics.
   ```
   NODE_ENV=development DEBUG=impresso* npm run update-newspapers
   NODE_ENV=development DEBUG=impresso* npm run update-topics
   ```
1. Start the app! Use the env variable `NODE_ENV` to switch between your development or production configuration file.
   ```
   NODE_ENV=development DEBUG=impresso* npm run dev
   ```


## Building and running with Docker

For local testing:

```shell
docker build \
  --progress plain \
  -f Dockerfile \
  -t impresso_middle_layer .
```

```shell
docker run \
  -p 8080:8080 \
  --rm -it impresso_middle_layer
```

## Deployment with forever

Make sure you have correctly set and tested the file `config/production.json` (is _.gitignored_).
You should create a `/path/to/forever.production.json` file:

```
{
  "uid": "impresso-middle-layer",
  "append": true,
  "watch": false,
  "script": "src/index.js",
  "sourceDir": "/path/to/impresso-middle-layer"
}
```

Then start with:

```
NODE_ENV=production forever start /path/to/forever.production.json
```

## Deployment with PM2

Install pm2, then [generate a template](https://pm2.io/doc/en/runtime/guide/ecosystem-file)
using the command `pm2 init` then edit the `ecosystem.config.js` file:

```
module.exports = {
  apps : [{
    name: 'impresso-middle-layer',
    cwd: '/path/to/impresso/impresso-middle-layer',
    script: 'src',

    //
    // args: 'one two',
    instances: 4,
    autorestart: false,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }],
}
```

Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/

## Testing

Simply run `npm test` and all your tests in the `test/` directory will be run.

## Scaffolding

Feathers has a powerful command line interface. Here are a few things it can do:

```
$ npm install -g feathers-cli             # Install Feathers CLI

$ feathers generate service               # Generate a new Service
$ feathers generate hook                  # Generate a new Hook
$ feathers generate model                 # Generate a new Model
$ feathers help                           # Show all commands
```

## Generating Typescipt types from JSON schemas

When a schema is updated, the typescript types should be regenerated. This can be done by running the following command:

```
npm run generate-types
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).

## Changelog

**1.0.0**

- Public release

## Project

The 'impresso - Media Monitoring of the Past' project is funded by the Swiss National Science Foundation (SNSF) under grant number [CRSII5_173719](http://p3.snf.ch/project-173719) (Sinergia program). The project aims at developing tools to process and explore large-scale collections of historical newspapers, and at studying the impact of this new tooling on historical research practices. More information at https://impresso-project.ch.

## License

Copyright (C) 2020 The _impresso_ team. Contributors to this program include: [Daniele Guido](https://github.com/danieleguido), [Roman Kalyakin](https://github.com/theorm), [Thijs van Beek](https://github.com/tvanbeek).
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
This program is distributed in the hope that it will be useful, but without any warranty; without even the implied warranty of merchantability or fitness for a particular purpose. See the [GNU Affero General Public License](https://github.com/impresso/impresso-middle-layer/blob/master/LICENSE) for more details.
