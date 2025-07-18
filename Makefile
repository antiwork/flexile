.PHONY: .setup

COMPOSE_PROJECT_NAME ?= flexile
DOCKER_COMPOSE_CMD ?= docker compose
LOCAL_DETACHED ?= true
LOCAL_DOCKER_COMPOSE_CONFIG = $(if $(and $(filter Linux,$(shell uname -s)),$(shell test ! -e /proc/sys/fs/binfmt_misc/WSLInterop && echo true)),docker-compose-local-linux.yml,docker-compose-local.yml)

local: .setup
	bin/generate_ssl_certificates
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) up $(if $(filter true,$(LOCAL_DETACHED)),-d)

stop_local:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) \
		$(DOCKER_COMPOSE_CMD) -f docker/$(LOCAL_DOCKER_COMPOSE_CONFIG) down

.setup:
	mkdir -p docker/tmp/postgres
	mkdir -p docker/tmp/redis
	mkdir -p docker/certs

.PHONY: ghpr
ghpr:
	@./scripts/create_pr.sh || true
