# Satellite Visibility Testing Framework

[![Test Suite](https://github.com/caderosche/visibility-testing/actions/workflows/test.yml/badge.svg)](https://github.com/caderosche/visibility-testing/actions/workflows/test.yml)
[![Performance Benchmark](https://github.com/caderosche/visibility-testing/actions/workflows/benchmark.yml/badge.svg)](https://github.com/caderosche/visibility-testing/actions/workflows/benchmark.yml)
[![Docker Build](https://github.com/caderosche/visibility-testing/actions/workflows/docker-build.yml/badge.svg)](https://github.com/caderosche/visibility-testing/actions/workflows/docker-build.yml)
[![Pages](https://github.com/caderosche/visibility-testing/actions/workflows/pages.yml/badge.svg)](https://github.com/caderosche/visibility-testing/actions/workflows/pages.yml)

**[📊 View Live Dashboard](https://caderosche.github.io/visibility-testing/)** | [Documentation](docs/README.md)

A comprehensive, multi-language testing framework for validating satellite visibility calculations. Compare implementations across different programming languages and libraries to ensure accuracy and consistency.

## What is Satellite Visibility Window Calculation?

A **visibility window** is a time period when a satellite is visible from a specific location on Earth. This occurs when the satellite rises above the horizon (at a minimum elevation angle) and remains visible until it sets below that angle again.

### Key Concepts

- **Elevation Angle**: The vertical angle between the horizon and the satellite. 0° means the satellite is on the horizon, 90° means directly overhead (zenith).
- **Azimuth**: The horizontal direction (compass bearing) where the satellite appears. 0° is North, 90° is East, 180° is South, 270° is West.
- **Range**: The direct line-of-sight distance from the observer to the satellite (measured in kilometers).
- **Visibility Window**: A continuous time period when elevation is above a minimum threshold (typically 10°).

### Why This Matters

Accurate visibility predictions are critical for:
- **Ground station operations**: Knowing when to communicate with satellites
- **Satellite photography**: Planning when to capture images of satellites
- **Amateur radio**: Timing communication windows with satellites
- **Space situational awareness**: Tracking satellite positions for collision avoidance
- **Scientific observations**: Scheduling telescope time for satellite observations

This framework validates that different SGP4 implementations produce consistent and accurate visibility predictions across multiple programming languages.

## Overview

This project provides:
- **Shared test cases** in a language-agnostic format
- **Multiple implementations** in different programming languages
- **Automated validation** to compare results against reference data
- **Performance benchmarking** to compare execution speed
- **CI/CD integration** via GitHub Actions
- **Interactive dashboard** with visualizations and analytics ([view live](https://caderosche.github.io/visibility-testing/))

## Project Status

**Phase 4 Complete!** ✅ All core implementations finished and validated.

- ✅ **6 implementations** across 5 languages (Python x2, JavaScript, Rust, C#, C++)
- ✅ **10/10 test cases passing** for all implementations
- ✅ **Docker-based** test orchestration
- ✅ **CI/CD workflows** for automated testing
- 📊 Performance range: 0.26s (Rust) to 22s (Skyfield reference)

See [PLAN.md](PLAN.md) for detailed development roadmap.

## Architecture

```
visibility-testing/
├── test-data/              # Shared test cases and reference results
│   ├── schema.json         # Test data format specification
│   ├── cases/              # Input test cases (JSON)
│   └── reference-results/  # Expected outputs (JSON)
│
├── implementations/        # Multiple libraries per language
│   ├── python-skyfield/    # Primary reference (Skyfield library)
│   ├── python-sgp4/        # Pure Python SGP4 implementation
│   ├── python-pyephem/     # Legacy PyEphem library
│   ├── javascript-satellite.js/  # Most popular JS library
│   ├── javascript-sgp4/    # Alternative JS implementation
│   ├── rust-sgp4/          # Primary Rust crate
│   ├── rust-satellite/     # Alternative Rust implementation
│   ├── cpp-vallado/        # Reference C++ implementation
│   ├── cpp-libsgp4/        # Alternative C++ library
│   ├── csharp-sgpnet/      # Primary .NET implementation
│   └── csharp-zeptomoby/   # Alternative .NET library
│
├── test-runner/            # Orchestration and validation framework
│   ├── orchestrator.js     # Executes all implementations
│   ├── validator.js        # Compares results with tolerances
│   ├── reporter.js         # Generates test reports
│   ├── storage/            # Result persistence (SQLite/JSON)
│   └── visualization/      # Chart generation and graphing
│
├── .github/workflows/      # CI/CD automation
│   ├── test.yml            # Main test workflow
│   └── benchmark.yml       # Performance tracking
│
├── docs/                   # Documentation
│   ├── implementation-guide.md
│   ├── test-data-format.md
│   └── tolerance-spec.md
│
├── PLAN.md                 # Development roadmap
└── README.md               # This file
```

## Multi-Library Testing Strategy

This framework tests **multiple libraries per language** to:
- Identify library-specific bugs and accuracy issues
- Compare performance across different implementations
- Provide recommendations for which libraries to use
- Ensure cross-validation within the same language ecosystem

### Libraries by Language

| Language | Libraries Tested | Status |
|----------|-----------------|--------|
| **Python** | Skyfield (primary), sgp4, PyEphem | Skyfield is reference |
| **JavaScript** | satellite.js, sgp4 npm package | TBD |
| **Rust** | sgp4 crate, satellite-rs | TBD |
| **C++** | Vallado SGP4, libsgp4 | TBD |
| **C#** | SGP.NET, Zeptomoby.OrbitTools | TBD |

### Why Multiple Libraries?

Different libraries may:
- Use different numerical precision or algorithms
- Have implementation bugs
- Optimize for speed vs. accuracy
- Have varying levels of maintenance and correctness

By testing multiple libraries per language, we can:
1. **Cross-validate** results within the same language
2. **Identify outliers** - libraries that deviate from consensus
3. **Recommend best practices** - which library to use for production
4. **Track improvements** - monitor library updates over time

## Docker-Based Execution

**All implementations run in Docker containers** for maximum reproducibility and portability.

### Why Docker?

- **Reproducibility**: Identical results across different machines and operating systems
- **Isolation**: No dependency conflicts between implementations
- **Portability**: Works anywhere Docker is installed (dev machines, CI/CD, servers)
- **Consistency**: Same environment in local development and production

### Quick Start with Docker

```bash
# Build all images
docker-compose build

# Run all tests
docker-compose up

# Run specific implementation
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield

# View results
cat results/python-skyfield_001_iss_nyc.json
```

### Docker Requirements

Every implementation must include:
- **Dockerfile** with complete build instructions
- **Pinned dependencies** (requirements.txt, package.json, Cargo.lock, etc.)
- **Standard volumes**: `/test-data` (read-only), `/results` (write)
- **Image naming**: `visibility-test/{language}-{library}:latest`

See [docs/docker-guide.md](docs/docker-guide.md) for complete Docker documentation.

## Test Data Format

Each test case includes:

```json
{
  "name": "ISS Pass Over NYC",
  "description": "International Space Station visibility from New York City",
  "satellite": {
    "tle": [
      "ISS (ZARYA)",
      "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005",
      "2 25544  51.6400 247.4627 0001320  67.4605 292.6523 15.54225995123456"
    ]
  },
  "observer": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "altitude": 0
  },
  "timeWindow": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z",
    "step": 60
  },
  "minElevation": 10.0
}
```

Expected output format:

```json
{
  "testCase": "ISS Pass Over NYC",
  "implementation": "python",
  "version": "1.0.0",
  "visibilityWindows": [
    {
      "start": "2024-01-01T06:23:15Z",
      "end": "2024-01-01T06:30:42Z",
      "maxElevation": 68.5,
      "maxElevationTime": "2024-01-01T06:27:01Z",
      "points": [
        {
          "time": "2024-01-01T06:23:15Z",
          "azimuth": 342.5,
          "elevation": 10.2,
          "range": 1423.7,
          "rangeRate": -5.234
        }
      ]
    }
  ],
  "executionTime": 0.042
}
```

## Implementation Interface

Each language implementation must:

1. **Have a Dockerfile** that builds a working container
2. **Read** test cases from mounted volume `/test-data/cases/*.json`
3. **Calculate** satellite visibility using the SGP4 propagator
4. **Output** results to `/results/{implementation}_{testcase}.json`
5. **Follow Docker naming**: `visibility-test/{language}-{library}:latest`

### Required Calculations
- Satellite position from TLE (SGP4/SDP4 propagation)
- Topocentric coordinates (azimuth, elevation, range)
- Visibility windows (elevation above threshold)
- Range rate (doppler shift indication)

### Docker Container Interface
Each implementation runs via Docker:
```bash
# Build image
docker build -t visibility-test/{language}-{library} implementations/{language}-{library}/

# Run all test cases
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/{language}-{library}

# Or use docker-compose
docker-compose up {language}-{library}
```

## Validation Tolerances

Results are compared with the following tolerances:

| Parameter | Tolerance | Reason |
|-----------|-----------|--------|
| Azimuth | ±0.1° | Atmospheric refraction variability |
| Elevation | ±0.1° | Propagation model differences |
| Range | ±1.0 km | TLE accuracy limitations |
| Time | ±1.0 sec | Discrete time step sampling |
| Range Rate | ±0.1 km/s | Numerical differentiation error |

## Quick Start

### Prerequisites
- **Docker** (REQUIRED) - Install from [docker.com](https://www.docker.com/get-started)
- Docker Compose (usually included with Docker Desktop)

### Running Tests Locally

```bash
# Run all implementations via Docker Compose
docker-compose up

# Run specific implementation
docker-compose up python-skyfield

# Rebuild and run
docker-compose up --build

# View results
ls -la results/
```

**Alternative: Run individual containers**
```bash
# Build specific image
docker build -t visibility-test/python-skyfield implementations/python-skyfield/

# Run tests
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield
```

### Adding a New Language Implementation

1. Create directory: `implementations/{language}-{library}/`
2. Create Dockerfile with complete build instructions
2. Implement the standardized interface (see `docs/implementation-guide.md`)
3. Add Docker configuration for CI
4. Register in test orchestrator
5. Run validation: `npm run test:{language}`

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## CI/CD

GitHub Actions automatically:
- Runs all implementations on every push/PR
- Validates results against reference data
- Tracks performance benchmarks
- Fails on tolerance violations
- Collects and stores results for trending
- Publishes charts and visualizations

## Interactive Dashboard

**[📊 View Live Dashboard](https://caderosche.github.io/visibility-testing/)**

An interactive web dashboard visualizes test results and provides comprehensive analytics:

### Features
- **Performance Rankings** - Real-time comparison of execution times across all implementations
- **Accuracy Histograms** - Precision analysis with error distribution charts (azimuth, elevation, range)
- **Test Case Breakdown** - Per-test performance comparison across languages
- **Implementation Details** - Detailed stats cards for each language/library combination
- **Dark Theme UI** - Modern, responsive design optimized for readability

### Technologies
- Static site hosted on GitHub Pages
- Chart.js for interactive visualizations
- Automatically updated on every push to master
- No backend required - pure HTML/CSS/JavaScript

### Local Preview
```bash
# Run tests
cd test-runner && cargo run --release -- run

# Update dashboard data
./docs/update-dashboard.sh

# View locally
cd docs && python3 -m http.server 8000
# Open http://localhost:8000
```

See [docs/README.md](docs/README.md) for dashboard development details.

## Performance Benchmarks

Target performance (preliminary):

| Language | Avg Time per Test | Relative Speed |
|----------|-------------------|----------------|
| Rust | TBD | 1.0x (baseline) |
| C++ | TBD | ~1.0x |
| C# | TBD | ~1.5-2x |
| Python | TBD | ~3-5x |
| JavaScript | TBD | ~2-4x |

## Use Cases

- **Library Validation**: Verify correctness of satellite tracking libraries
- **Cross-Platform Testing**: Ensure consistent results across environments
- **Performance Comparison**: Benchmark execution speed across languages
- **Educational Tool**: Learn satellite visibility algorithms
- **Reference Implementation**: Ground truth for new implementations

## Supported Languages and Libraries (Planned)

### Python (Reference Language)
- [x] **Skyfield** - Primary reference implementation
- [ ] **sgp4** - Pure Python SGP4
- [ ] **PyEphem** - Legacy library

### JavaScript/TypeScript
- [ ] **satellite.js** - Most popular
- [ ] **sgp4** (npm) - Alternative

### Rust
- [ ] **sgp4** crate - Primary
- [ ] **satellite-rs** - Alternative

### C++
- [ ] **Vallado SGP4** - Reference implementation
- [ ] **libsgp4** - Alternative

### C#
- [ ] **SGP.NET** - Primary
- [ ] **Zeptomoby.OrbitTools** - Alternative

## Roadmap

See [PLAN.md](PLAN.md) for the complete development roadmap broken into 7 phases:

1. **Foundation & Infrastructure** - Test data schema and initial cases
2. **Reference Implementation** - Python implementation with ground truth
3. **Test Orchestration** - Automated validation framework
4. **Additional Languages** - Multiple language implementations
5. **CI/CD Integration** - GitHub Actions automation
6. **Expansion** - More test cases and features
7. **Documentation** - Comprehensive guides and tutorials

## Contributing

Contributions welcome! Areas of interest:
- New language implementations
- Additional test cases
- Performance optimizations
- Documentation improvements
- Visualization tools

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[To be determined]

## Resources

### Satellite Tracking Libraries

**Python**:
- [Skyfield](https://github.com/skyfielders/python-skyfield) - Primary reference, high accuracy
- [sgp4](https://github.com/brandon-rhodes/python-sgp4) - Pure Python implementation
- [PyEphem](https://github.com/brandon-rhodes/pyephem) - Legacy but widely used

**JavaScript/TypeScript**:
- [satellite.js](https://github.com/shashwatak/satellite-js) - Most popular JS library
- [sgp4](https://www.npmjs.com/package/sgp4) - Alternative npm package

**Rust**:
- [sgp4](https://github.com/neuromorphicsystems/sgp4) - Primary Rust implementation
- Other Rust libraries TBD

**C++**:
- [Vallado SGP4](https://celestrak.com/software/vallado-sw.php) - Reference C++ implementation
- [libsgp4](https://github.com/dnwrnr/sgp4) - Alternative library

**C#**:
- [SGP.NET](https://github.com/parzivail/SGP.NET) - .NET port of Vallado's code
- [Zeptomoby.OrbitTools](http://www.zeptomoby.com/satellites/) - Alternative .NET library

### References
- [Simplified General Perturbations #4 (SGP4)](https://en.wikipedia.org/wiki/Simplified_perturbations_models)
- [Two-Line Element Set](https://en.wikipedia.org/wiki/Two-line_element_set)
- [CelesTrak](https://celestrak.org/) - TLE data source
- [NORAD SGP4 Standard](https://www.space-track.org/documentation#/sgp4)

## Contact

[To be determined]
