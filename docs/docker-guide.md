# Docker Architecture Guide

This document explains how Docker is used throughout the Satellite Visibility Testing Framework to ensure reproducibility and consistency across different machines and environments.

## Overview

**All tests run in Docker containers** to guarantee:
- **Reproducibility**: Same results regardless of host machine
- **Isolation**: Each implementation runs in its own container
- **Portability**: Works on any machine with Docker installed
- **Consistency**: Identical environments in local dev, CI/CD, and production
- **Dependency Management**: No conflicts between different language versions

## Architecture Principles

### 1. One Container Per Implementation

Each language/library combination gets its own Docker image:
```
implementations/
├── python-skyfield/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
├── python-sgp4/
│   ├── Dockerfile
│   └── ...
├── javascript-satellite.js/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
```

### 2. Standardized Image Naming

All Docker images follow this convention:
```
visibility-test/{language}-{library}:latest
```

Examples:
- `visibility-test/python-skyfield:latest`
- `visibility-test/javascript-satellite.js:latest`
- `visibility-test/rust-sgp4:latest`

### 3. Volume Mounting for Data

Test data and results are shared via Docker volumes:
```
docker run -v ./test-data:/test-data \
           -v ./results:/results \
           visibility-test/python-skyfield:latest
```

Containers read from `/test-data` and write to `/results`.

### 4. Standardized Container Interface

Every container must:
1. Accept test case name as argument (or run all if no argument)
2. Read test cases from `/test-data/cases/`
3. Write results to `/results/{implementation}_{testcase}.json`
4. Exit with code 0 on success, non-zero on failure
5. Output progress/errors to stdout/stderr

## Docker Image Structure

### Base Image Selection

Each implementation uses official language images:

| Language | Base Image | Rationale |
|----------|------------|-----------|
| Python | `python:3.11-slim` | Small size, official, widely used |
| JavaScript | `node:20-slim` | LTS version, minimal footprint |
| Rust | `rust:1.70-slim` | Official Rust image |
| C++ | `gcc:latest` or `ubuntu:22.04` | Standard build tools |
| C# | `mcr.microsoft.com/dotnet/runtime:7.0` | Official .NET runtime |

### Dockerfile Template

```dockerfile
# Base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Set entrypoint
ENTRYPOINT ["python", "src/main.py"]
```

### Key Dockerfile Practices

1. **Layer Caching**: Copy dependency files before source code
2. **Minimal Layers**: Combine RUN commands where possible
3. **No Cache for Dependencies**: Use `--no-cache-dir` to reduce image size
4. **Specific Versions**: Pin dependency versions for reproducibility
5. **Non-Root User**: Run as non-root user when possible (security)

## Running Tests

### Local Development

#### Run Single Implementation
```bash
# Build image
docker build -t visibility-test/python-skyfield implementations/python-skyfield/

# Run all test cases
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield

# Run specific test case
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield 001_iss_nyc
```

#### Run All Implementations with Docker Compose
```bash
# Run full test suite
docker-compose up

# Run specific implementation
docker-compose up python-skyfield

# Rebuild and run
docker-compose up --build

# Clean up
docker-compose down -v
```

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  # Test orchestrator
  orchestrator:
    build: ./test-runner
    volumes:
      - ./test-data:/test-data:ro
      - ./results:/results
      - /var/run/docker.sock:/var/run/docker.sock  # Access to Docker daemon
    depends_on:
      - python-skyfield
      - python-sgp4
      # ... other implementations

  # Python implementations
  python-skyfield:
    build: ./implementations/python-skyfield
    image: visibility-test/python-skyfield:latest
    volumes:
      - ./test-data:/test-data:ro
      - ./results:/results
    mem_limit: 512m
    cpu_count: 1

  python-sgp4:
    build: ./implementations/python-sgp4
    image: visibility-test/python-sgp4:latest
    volumes:
      - ./test-data:/test-data:ro
      - ./results:/results
    mem_limit: 512m
    cpu_count: 1

  # JavaScript implementations
  javascript-satellite-js:
    build: ./implementations/javascript-satellite.js
    image: visibility-test/javascript-satellite.js:latest
    volumes:
      - ./test-data:/test-data:ro
      - ./results:/results
    mem_limit: 512m
    cpu_count: 1

  # ... other implementations
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test All Implementations

on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        implementation:
          - python-skyfield
          - python-sgp4
          - javascript-satellite.js
          - rust-sgp4
          # ... others

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build Docker image
        run: |
          docker build -t visibility-test/${{ matrix.implementation }} \
            implementations/${{ matrix.implementation }}/

      - name: Run tests
        run: |
          docker run --rm \
            -v ${{ github.workspace }}/test-data:/test-data:ro \
            -v ${{ github.workspace }}/results:/results \
            visibility-test/${{ matrix.implementation }}

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: results-${{ matrix.implementation }}
          path: results/
```

## Test Orchestrator Architecture

The test orchestrator runs in its own container and coordinates other containers:

```python
# Orchestrator pseudo-code
import docker

client = docker.from_env()

# Discover implementations
images = client.images.list(filters={"label": "visibility-test"})

for image in images:
    # Run container
    container = client.containers.run(
        image.tags[0],
        volumes={
            './test-data': {'bind': '/test-data', 'mode': 'ro'},
            './results': {'bind': '/results', 'mode': 'rw'}
        },
        mem_limit='512m',
        detach=True
    )

    # Wait for completion
    result = container.wait()

    # Collect logs
    logs = container.logs()

    # Clean up
    container.remove()
```

## Performance Monitoring

Docker provides built-in performance metrics:

```bash
# Monitor resource usage during test
docker stats --no-stream

# Get container execution time
time docker run ... visibility-test/python-skyfield

# Memory usage in results
docker inspect <container-id> | jq '.[0].HostConfig.Memory'
```

## Troubleshooting

### Common Issues

#### 1. Volume Mount Permissions
**Problem**: Container cannot read test-data or write results

**Solution**: Ensure proper permissions
```bash
chmod -R 755 test-data
chmod -R 777 results
```

#### 2. Docker Image Build Failures
**Problem**: Dependencies fail to install

**Solution**: Check Dockerfile for proper dependency specification
```dockerfile
# Use specific versions
RUN pip install skyfield==1.45 numpy==1.24.0
```

#### 3. Container Exits Immediately
**Problem**: Container exits with code 0 but produces no output

**Solution**: Check container logs
```bash
docker logs <container-id>
```

#### 4. Out of Memory
**Problem**: Container killed due to OOM

**Solution**: Increase memory limit
```bash
docker run --memory=1g ...
```

### Debugging Containers

```bash
# Run container interactively
docker run -it --entrypoint /bin/bash visibility-test/python-skyfield

# Inspect running container
docker exec -it <container-id> /bin/bash

# View container logs
docker logs <container-id>

# Inspect image layers
docker history visibility-test/python-skyfield
```

## Best Practices

### 1. Keep Images Small
- Use slim/alpine base images
- Remove build dependencies after compilation
- Use multi-stage builds for compiled languages
- Don't include test data in images

### 2. Optimize Build Times
- Order Dockerfile commands from least to most frequently changing
- Use BuildKit for parallel builds
- Cache dependency installation layers

### 3. Security
- Don't run as root user
- Use specific base image versions (not `latest`)
- Scan images for vulnerabilities
- Don't include secrets in images

### 4. Reproducibility
- Pin all dependency versions
- Use lock files (requirements.txt, package-lock.json, Cargo.lock)
- Tag images with version numbers
- Document base image versions

## Example: Complete Implementation with Docker

### Directory Structure
```
implementations/python-skyfield/
├── Dockerfile
├── requirements.txt
├── src/
│   ├── main.py
│   ├── calculator.py
│   └── parser.py
└── README.md
```

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Create non-root user
RUN useradd -m -u 1000 testuser && \
    chown -R testuser:testuser /app
USER testuser

# Set entrypoint
ENTRYPOINT ["python", "src/main.py"]
CMD []
```

### requirements.txt
```
skyfield==1.45
numpy==1.24.0
```

### Build and Run
```bash
# Build
docker build -t visibility-test/python-skyfield implementations/python-skyfield/

# Test locally
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield

# Verify results
ls -la results/
cat results/python-skyfield_001_iss_nyc.json
```

## Future Enhancements

- Container registry for pre-built images
- Kubernetes deployment for large-scale testing
- Docker image vulnerability scanning
- Automated image updates
- Multi-architecture builds (amd64, arm64)
