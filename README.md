# Satellite Visibility Testing Framework

A comprehensive, multi-language testing framework for validating satellite visibility calculations. Compare implementations across different programming languages and libraries to ensure accuracy and consistency.

## Overview

This project provides:
- **Shared test cases** in a language-agnostic format
- **Multiple implementations** in different programming languages
- **Automated validation** to compare results against reference data
- **Performance benchmarking** to compare execution speed
- **CI/CD integration** via GitHub Actions

## Project Status

Currently in planning phase. See [PLAN.md](PLAN.md) for detailed development roadmap.

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

## Result Collection & Visualization

The framework includes comprehensive result collection and graphing capabilities:

### Data Collection
- **Persistent Storage**: Results stored in SQLite database or JSON files
- **Historical Tracking**: All test runs saved with timestamps for trend analysis
- **Metrics Captured**: Execution time, accuracy deltas, pass/fail status, memory usage

### Visualizations
- **Accuracy Charts**: Bar/scatter plots showing deltas from reference implementation
- **Performance Charts**: Execution time comparisons by language and test case
- **Trend Graphs**: Performance and accuracy trends over time
- **Error Distributions**: Histograms of deviation from reference
- **Comparison Matrix**: Heatmaps showing relative accuracy and performance
- **Satellite Visualizations**: Ground tracks, sky charts, visibility timelines

### Dashboard
- Interactive web dashboard with latest test results
- Historical benchmark comparison
- Filtering by test case, language, and date range
- Drill-down into specific failures or outliers
- Export charts as PNG/SVG for reports

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
- [Skyfield](https://rhodesmill.org/skyfield/) - Primary reference, high accuracy
- [sgp4](https://pypi.org/project/sgp4/) - Pure Python implementation
- [PyEphem](https://rhodesmill.org/pyephem/) - Legacy but widely used

**JavaScript/TypeScript**:
- [satellite.js](https://github.com/shashwatak/satellite-js) - Most popular JS library
- [sgp4](https://www.npmjs.com/package/sgp4) - Alternative npm package

**Rust**:
- [sgp4 crate](https://crates.io/crates/sgp4) - Primary Rust implementation
- Other Rust libraries TBD

**C++**:
- [Vallado SGP4](https://www.danrw.com/sgp4/) - Reference C++ implementation
- [libsgp4](https://github.com/dnwrnr/sgp4) - Alternative library

**C#**:
- [SGP.NET](https://www.danrw.com/sgp4-net/) - .NET port of Vallado's code
- [Zeptomoby.OrbitTools](https://www.zeptomoby.com/satellites/) - Alternative .NET library

### References
- [Simplified General Perturbations #4 (SGP4)](https://en.wikipedia.org/wiki/Simplified_perturbations_models)
- [Two-Line Element Set](https://en.wikipedia.org/wiki/Two-line_element_set)
- [CelesTrak](https://celestrak.org/) - TLE data source
- [NORAD SGP4 Standard](https://www.space-track.org/documentation#/sgp4)

## Contact

[To be determined]
