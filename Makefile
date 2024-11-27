NAME = up

PROJECT = "ft_transcendence"

HOSTNAME ?= $(shell hostname -A | cut -d' ' -f1)

IMAGES =	src-grafana\
			src-prometheus\
			src-alertmanager\
			src-node-exporter\
			src-cadvisor\
			\
			src-nginx\
			src-django\
			src-postgresql\
			src-game_server\
			src-chat_server\


VOLUMES =	src_static_files\
			src_postgres_data\
			src_prometheus_data

all: $(NAME)

$(NAME): update-hostname
	@docker compose --project-directory src up -d
	@echo Project available at https://$(HOSTNAME):8080

update-hostname:
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/.env
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/requirements/django/src/pong/templates/js/utils/socketManager.js
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/requirements/django/src/pong/templates/js/views/dashboard.js
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/requirements/game_server/game/main.mjs
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/requirements/game_server/game/server.mjs
	@sed -i 's|https://[^:]*:8080|https://$(HOSTNAME):8080|g' src/requirements/django/src/pong/views.py
	@echo "Hostname updated to $(HOSTNAME)"

start: all

down:
	@docker compose --project-directory src down -t 0

stop: down

clean: down
	@docker image rm -f $(IMAGES) > /dev/null 2>&1
	@echo "Images removed."

fclean: clean
	@docker volume rm -f $(VOLUMES) > /dev/null
	@echo "Volumes removed."

re: clean all

refclean: fclean all

debug: $(NAME)
	@docker compose --project-directory src logs -f

.PHONY: all up start down stop clean fclean re refclean update-hostname debug