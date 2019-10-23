build:
	docker build -t impresso/impresso-middle-layer .

run-dev:
	cd docker && docker-compose up --force-recreate
