dev:
	docker compose up --build

prod:
	docker compose -f docker-compose.prod.yml --env-file .env.prod up --build

down:
	docker compose -f docker-compose.prod.yml down
	docker compose down