# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-language testing framework for validating satellite visibility calculations. The project compares implementations across different programming languages (Python, JavaScript, Rust, C++, C#) to ensure accuracy and consistency in satellite tracking algorithms.

**Current Status**: Planning phase - the directory structure and implementations do not exist yet.

## Architecture

### Core Design Principles

1. **Docker-First Architecture**: All implementations run in isolated Docker containers for reproducibility and portability
2. **Language-Agnostic Test Data**: All test cases are stored in JSON format so any language implementation can consume them
3. **Reference Implementation Pattern**: Python Skyfield serves as the ground truth; all other implementations are validated against it
4. **Multi-Library Testing**: Each language tests 2-3 different SGP4 libraries to identify library-specific bugs and accuracy issues
5. **Standardized Interface Contract**: Every language/library must implement the same input/output interface for automated testing
6. **Validation with Tolerances**: Results are compared using configurable floating-point tolerances (±0.1° for angles, ±1km for range, ±1s for time)

### Directory Structure

The planned architecture (see PLAN.md Phase 1-7):

```
test-data/              # Shared test cases (JSON) - language agnostic
  ├── schema.json       # Defines test case format
  ├── cases/            # Input test scenarios
  └── reference-results/ # Expected outputs from reference implementation

implementations/        # Multiple libraries per language: {language}-{library}/
  ├── python-skyfield/  # Primary reference (generates ground truth)
  ├── python-sgp4/      # Pure Python SGP4 implementation
  ├── python-pyephem/   # Legacy library
  ├── javascript-satellite.js/
  ├── javascript-sgp4/
  ├── rust-sgp4/
  ├── rust-satellite/
  ├── cpp-vallado/
  ├── cpp-libsgp4/
  ├── csharp-sgpnet/
  └── csharp-zeptomoby/

test-runner/           # Orchestration layer (likely Node.js or Python)
  ├── orchestrator     # Discovers and runs all implementations
  ├── validator        # Compares results against reference with tolerances
  ├── reporter         # Generates comparison reports
  ├── storage/         # Result persistence (SQLite/JSON) for historical tracking
  └── visualization/   # Chart generation (accuracy, performance, trends)

.github/workflows/     # CI/CD automation
  ├── test.yml         # Runs all implementations, validates results
  └── benchmark.yml    # Performance tracking

docker-compose.yml     # Orchestrates all Docker containers
```

### Docker Architecture

**All implementations run in Docker containers** for:
- Reproducibility across different machines
- Isolation between language environments
- Consistent dependency versions
- Simplified CI/CD integration

**Docker Image Naming Convention**:
```
visibility-test/{language}-{library}:latest
```

**Container Interface**:
- Each implementation has its own Dockerfile
- Test data mounted as read-only volume: `/test-data`
- Results written to volume: `/results`
- Containers executed via docker-compose or direct docker run

**Example Dockerfile Structure**:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
ENTRYPOINT ["python", "src/main.py"]
```

**Running Tests**:
```bash
# Build and run all implementations
docker-compose up

# Run specific implementation
docker run --rm \
  -v $(pwd)/test-data:/test-data:ro \
  -v $(pwd)/results:/results \
  visibility-test/python-skyfield
```

See `docs/docker-guide.md` for complete Docker documentation.

### Test Data Format

Each test case includes:
- **Satellite TLE** (Two-Line Element format)
- **Observer location** (lat/lon/altitude)
- **Time window** (start/end/step)
- **Minimum elevation** threshold

Each implementation outputs:
- **Visibility windows** (when satellite is above horizon)
- **Azimuth/elevation/range/range-rate** at each time step
- **Execution time** for benchmarking

### Implementation Contract

Every language implementation must:
1. **Have a Dockerfile** that builds a working container
2. Read test cases from mounted volume `/test-data/cases/*.json`
3. Calculate satellite visibility using SGP4 propagation model
4. Output results to `/results/{implementation}_{testcase}.json` in standardized JSON format
5. Follow Docker image naming: `visibility-test/{language}-{library}:latest`
6. Include all dependencies in the Docker image (no external dependencies)
7. Exit with code 0 on success, non-zero on failure

## Development Workflow

### Phase Sequence (see PLAN.md for details)

1. **Phase 1**: Define test data schema and create initial test cases ✅ COMPLETED
2. **Phase 2**: Build Python reference implementations (Skyfield, sgp4, PyEphem)
3. **Phase 3**: Build test orchestration framework (runs all implementations and validates)
4. **Phase 4**: Add JavaScript, Rust, C++, C# implementations (multiple libraries per language)
5. **Phase 5**: Set up GitHub Actions CI/CD
6. **Phase 6**: Expand test cases and add features
7. **Phase 7**: Documentation and community guidelines

### Multi-Library Testing Strategy

**Why test multiple libraries per language?**
- Identify library-specific bugs and implementation errors
- Cross-validate results within the same language ecosystem
- Compare performance characteristics of different libraries
- Provide recommendations for which library to use in production

**Naming convention**: `implementations/{language}-{library}/`
- Example: `python-skyfield/`, `javascript-satellite.js/`, `rust-sgp4/`

**For each language, test 2-3 libraries:**
- Primary/most popular library
- Alternative implementations
- Custom implementations if needed

### When Adding a New Language/Library Implementation

1. Create `implementations/{language}-{library}/` directory
2. **Create Dockerfile** (REQUIRED):
   - Choose appropriate base image (e.g., `python:3.11-slim`, `node:20-slim`)
   - Install dependencies with pinned versions
   - Copy source code
   - Set entrypoint for test execution
   - Follow naming: `visibility-test/{language}-{library}:latest`
3. Implement the standardized interface:
   - Input: Read JSON from mounted volume `/test-data/cases/`
   - Processing: SGP4 propagation and visibility calculation
   - Output: Write results to `/results/{implementation}_{testcase}.json`
   - Include library name and version in output metadata
4. Test Docker image locally:
   ```bash
   docker build -t visibility-test/{language}-{library} .
   docker run --rm -v ./test-data:/test-data:ro -v ./results:/results visibility-test/{language}-{library}
   ```
5. Add to `docker-compose.yml`
6. Run validation to ensure results match reference within tolerances
7. Compare with other libraries in the same language
8. Document setup in README (both Docker and native)
9. Document any known issues or deviations

### When Adding Test Cases

1. Add new JSON file to `test-data/cases/`
2. Run reference implementation (Python) to generate ground truth
3. Save reference results to `test-data/reference-results/`
4. Run test orchestrator to validate all implementations against new test case

### Result Collection and Visualization

The framework includes comprehensive result collection and graphing:

**Storage Layer** (Phase 3):
- Results persisted to SQLite database or JSON files
- Schema includes: timestamp, implementation, test case, results, metrics
- Historical data enables trend analysis and regression detection

**Visualization** (Phase 3):
- Accuracy comparison charts (deltas from reference)
- Performance comparison charts (execution time by language/test case)
- Trend graphs (performance and accuracy over time)
- Error distribution histograms
- Charts exported as PNG/SVG for reports

**CI/CD Integration** (Phase 5):
- CI runs automatically store results for trending
- Generated charts uploaded as artifacts
- Interactive dashboard published with latest results
- Performance regression alerts when slowdowns detected

**Web Dashboard** (Phase 6):
- Live test results from latest CI run
- Historical benchmarks with trend lines
- Interactive filtering by test case, language, date range
- Satellite-specific visualizations (ground tracks, sky charts, visibility timelines)

## Key Constraints

### Validation Tolerances

These are defined in the project spec and should NOT be changed without good reason:

- Azimuth: ±0.1° (accounts for atmospheric refraction variability)
- Elevation: ±0.1° (accounts for propagation model differences)
- Range: ±1.0 km (TLE accuracy limitations)
- Time: ±1.0 sec (discrete time step sampling)
- Range Rate: ±0.1 km/s (numerical differentiation error)

### Library Requirements

Each language tests multiple established SGP4 libraries:

**Python** (reference language):
- **Skyfield** - Primary reference (most accurate)
- **sgp4** - Pure Python implementation
- **PyEphem** - Legacy but widely used

**JavaScript/TypeScript**:
- **satellite.js** - Most popular
- **sgp4** (npm) - Alternative

**Rust**:
- **sgp4** crate - Primary
- **satellite-rs** - Alternative

**C++**:
- **Vallado SGP4** - Reference implementation
- **libsgp4** - Alternative

**C#**:
- **SGP.NET** - Primary
- **Zeptomoby.OrbitTools** - Alternative

## Important Notes

- **Docker is REQUIRED**: Every implementation must have a working Dockerfile - no exceptions
- **Python Skyfield** is the primary reference implementation - all other implementations (including other Python libraries) are validated against it
- Each language tests 2-3 different libraries to identify library-specific bugs and provide recommendations
- Libraries within the same language can be cross-validated against each other
- All test data uses TLE format for orbital elements (standard NORAD format)
- The test orchestrator runs implementations via Docker containers (not native execution)
- Performance benchmarking is secondary to correctness - implementations must pass validation before performance matters
- Docker ensures reproducibility across different machines, operating systems, and CI environments
- Volume mounting is used for test data (read-only) and results (write)
- **Always update PLAN.md after completing tasks** to track progress

## Docker Requirements Summary

Every implementation must include:
1. **Dockerfile** - Builds complete execution environment
2. **Dependency files** with pinned versions (requirements.txt, package.json, etc.)
3. **Entrypoint** that executes tests
4. **Standard volumes**: `/test-data` (input) and `/results` (output)
5. **Image naming**: `visibility-test/{language}-{library}:latest`
6. **Exit codes**: 0 for success, non-zero for failure

See `docs/docker-guide.md` for complete Docker documentation.
- your job is not to analysis the results, just to write the code that presents the results.