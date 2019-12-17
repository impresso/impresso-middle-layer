build:
	docker build -t impresso/impresso-middle-layer .

run-redis:
	docker run --rm -it --name redis -p 6379:6379 redis
