.PHONY: help build run validate discover all clean docker-build docker-run

# Default target
help:
	@cd test-runner && cargo run --release -- --help

# Build orchestrator
build:
	cd test-runner && cargo build --release

# Orchestrator commands
discover:
	cd test-runner && cargo run --release -- discover

run:
ifdef IMPL
	cd test-runner && cargo run --release -- run -i $(IMPL)
else
	cd test-runner && cargo run --release -- run
endif

validate:
ifdef IMPL
	cd test-runner && cargo run --release -- validate -i $(IMPL)
else
	cd test-runner && cargo run --release -- validate
endif

all:
	cd test-runner && cargo run --release -- all

clean:
	cd test-runner && cargo clean

# Docker commands
docker-build:
	docker compose build

docker-run:
	docker compose run python-skyfield
	docker compose run python-sgp4
	docker compose run javascript-satellite.js
	docker compose run rust-sgp4

docker-clean:
	rm -f results/*

# Quick test with specific implementation
test-rust:
	docker compose run rust-sgp4

test-js:
	docker compose run javascript-satellite.js

test-python:
	docker compose run python-skyfield
