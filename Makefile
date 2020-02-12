build:
	docker build \
		-t impresso/impresso-middle-layer \
		--build-arg GIT_BRANCH=$(shell git rev-parse --abbrev-ref HEAD) \
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
