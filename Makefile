BUILD_TAG ?= latest

build:
	docker build \
		-t impresso/impresso-middle-layer:${BUILD_TAG} \
		--build-arg GIT_BRANCH=$(shell git rev-parse --abbrev-ref HEAD) \
		--build-arg GIT_TAG=$(shell git describe --tags --abbrev=0 HEAD) \
		--build-arg GIT_REVISION=$(shell git rev-parse --short HEAD) .
		
run:
	docker run --rm -it \
		--name impresso_middle_layer \
		-p 3030:3030 \
		-v $(shell pwd)/config:/impresso-middle-layer/config \
		-e NODE_ENV=development \
		impresso/impresso-middle-layer

run-redis:
	docker run --rm -it --name redis -p 6379:6379 redis

run-dev:
	GIT_TAG=$(shell git describe --tags --abbrev=0 HEAD) \
	GIT_BRANCH=$(shell git rev-parse --abbrev-ref HEAD) \
	GIT_REVISION=$(shell git rev-parse --short HEAD) \
	NODE_ENV=development DEBUG=impresso* \
	npm run dev
