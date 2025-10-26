# Satellite Visibility Test Runner

Docker-based test orchestrator for running and validating satellite visibility implementations across multiple languages and libraries.

## Overview

This Rust CLI tool automatically discovers, builds, runs, and validates satellite visibility implementations. It uses Docker to ensure consistent execution environments and provides comprehensive result validation.

## Features

- **Auto-discovery**: Scans `implementations/` directory for Dockerfiles
- **Docker-based execution**: Runs all implementations in isolated containers
- **Parallel testing**: Execute multiple implementations sequentially with performance tracking
- **Result validation**: Compares results against reference implementation (python-skyfield)
- **CLI interface**: Simple command-line interface using clap library

## Installation

### Prerequisites

- Rust 1.70+ (with 2024 edition support)
- Docker
- cargo

### Build

```bash
cd test-runner
cargo build --release
```

The binary will be available at `target/release/visibility-test-runner`

## Usage

### Discover Implementations

Find all implementations with Dockerfiles:

```bash
./target/release/visibility-test-runner discover
```

### Build Docker Images

Build all implementation images:

```bash
./target/release/visibility-test-runner build
```

Build specific implementation:

```bash
./target/release/visibility-test-runner build --implementation python-skyfield
```

### Run Tests

Run all implementations:

```bash
./target/release/visibility-test-runner run
```

Run specific implementation:

```bash
./target/release/visibility-test-runner run --implementation python-sgp4
```

Run specific test case:

```bash
./target/release/visibility-test-runner run --test-case 001_iss_nyc
```

Build and run:

```bash
./target/release/visibility-test-runner run --build
```

### Validate Results

Validate all implementations against reference:

```bash
./target/release/visibility-test-runner validate
```

Validate specific implementation:

```bash
./target/release/visibility-test-runner validate --implementation python-sgp4
```

### Run Complete Test Suite

Build, run, and validate everything:

```bash
./target/release/visibility-test-runner all
```

Run complete suite for specific test case:

```bash
./target/release/visibility-test-runner all --test-case 001_iss_nyc
```

## Commands

| Command | Description |
|---------|-------------|
| `discover` | Discover all implementations by scanning for Dockerfiles |
| `build` | Build Docker images for implementations |
| `run` | Run tests for implementations |
| `validate` | Validate results against reference implementation |
| `all` | Run complete test suite (build + run + validate) |

## Options

### Build Command

- `-i, --implementation <NAME>` - Build specific implementation

### Run Command

- `-i, --implementation <NAME>` - Run specific implementation
- `-t, --test-case <NAME>` - Run specific test case
- `-b, --build` - Build images before running

### Validate Command

- `-i, --implementation <NAME>` - Validate specific implementation

### All Command

- `-t, --test-case <NAME>` - Run specific test case

## Output

The orchestrator provides:

1. **Build Status**: Success/failure for each Docker image build
2. **Test Results**: Execution time and success status for each implementation
3. **Validation Results**: Window count comparison against reference
4. **Summary**: Overall test suite results

Example output:

```
Satellite Visibility Test Suite
==================================================
Discovered 2 implementation(s)
  - python-sgp4
  - python-skyfield

Building images...
--------------------------------------------------
Building python-sgp4...
  ✓ Built visibility-test/python-sgp4:latest
Building python-skyfield...
  ✓ Built visibility-test/python-skyfield:latest

Running tests...
--------------------------------------------------
Running tests for python-sgp4...
  ✓ Tests completed in 0.45s
Running tests for python-skyfield...
  ✓ Tests completed in 18.32s

Validating results...
--------------------------------------------------
Validating results for python-sgp4...
  ✓ 001_iss_nyc - 6 window(s)
  ✓ 002_starlink_sf - 0 window(s)
  ...

Validation: 10/10 test cases match reference

Final Summary:
==================================================
✓ python-sgp4 - 0.45s
✓ python-skyfield - 18.32s
```

## Directory Structure

```
test-runner/
├── Cargo.toml           # Rust project configuration
├── src/
│   └── main.rs         # Orchestrator implementation
├── storage/            # Result persistence (future)
├── visualization/      # Chart generation (future)
└── README.md          # This file
```

## How It Works

1. **Discovery**: Scans `../implementations/` for directories containing Dockerfiles
2. **Image Naming**: Uses convention `visibility-test/{impl-name}:latest`
3. **Volume Mounting**: Mounts `test-data` (read-only) and `results` directories
4. **Execution**: Runs containers with optional test case argument
5. **Collection**: Gathers JSON result files from `results/` directory
6. **Validation**: Compares visibility window counts with reference implementation

## Validation Logic

The orchestrator validates implementations by:

1. Loading result JSON files for each implementation
2. Finding corresponding reference files (python-skyfield)
3. Comparing visibility window counts
4. Reporting matches and mismatches

A test case passes validation if the number of visibility windows matches the reference.

## Performance Tracking

Each test run records:

- Execution time (wall clock time for Docker container)
- Success/failure status
- stdout/stderr output

Future enhancements will include:
- Historical performance tracking
- Regression detection
- Resource usage monitoring (CPU, memory)

## Future Enhancements

- [ ] Parallel test execution using tokio
- [ ] Result persistence to SQLite database
- [ ] Historical performance tracking
- [ ] Detailed validation (azimuth, elevation, range tolerances)
- [ ] Chart generation for result visualization
- [ ] JSON/HTML report generation
- [ ] CI/CD integration helpers
- [ ] Docker resource limits and monitoring

## Contributing

To add a new implementation:

1. Create directory in `implementations/{language}-{library}/`
2. Add Dockerfile
3. Implement standardized interface (read from `/test-data`, write to `/results`)
4. Run `visibility-test-runner discover` to verify detection
5. Run `visibility-test-runner all` to test and validate

## Dependencies

- **clap**: CLI argument parsing
- **serde/serde_json**: JSON serialization
- **tokio**: Async runtime (for future parallel execution)
- **anyhow**: Error handling
- **walkdir**: Directory traversal

## Version History

- 0.1.0 (2024-10-26) - Initial release with core orchestration features

## License

Same as parent project.
