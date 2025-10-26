# JavaScript satellite.js Implementation

Implementation using the [satellite.js](https://github.com/shashwatak/satellite-js) library for satellite visibility calculations.

## Overview

This implementation uses satellite.js, the most popular JavaScript library for satellite orbit propagation. It's a pure JavaScript port of the SGP4/SDP4 algorithms.

**Status**: Functional implementation validated against python-skyfield reference.

## Features

- Pure JavaScript SGP4/SDP4 propagation
- ECI to ECEF coordinate transformations
- Geodetic to ECEF conversions
- Topocentric (Az/El) calculations
- Visibility window detection
- Range and range rate calculations

## Dependencies

- Node.js 18+
- satellite.js 5.0.0

## Usage

### Docker (Recommended)

```bash
# Build image
docker build -t visibility-test/javascript-satellite.js .

# Run all test cases
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/javascript-satellite.js

# Run specific test case
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/javascript-satellite.js 001_iss_nyc
```

### Native Node.js

```bash
# Install dependencies
npm install

# Run all test cases
node src/index.js

# Run specific test case
node src/index.js 001_iss_nyc
```

## Implementation Details

### Coordinate Transformations

1. **Geodetic to ECEF**: Observer location converted using WGS84 ellipsoid
2. **SGP4 Propagation**: Satellite position calculated in ECI frame
3. **ECI to ECEF**: Using Greenwich Sidereal Time (GMST) rotation
4. **ECEF to Topocentric**: Range vector transformed to SEZ (South-East-Zenith) frame
5. **SEZ to Az/El**: Final conversion to azimuth and elevation angles

### Key Differences from Python Implementations

- **satellite.js API**: Higher-level than pure sgp4, similar to Skyfield
- **Built-in conversions**: Includes eciToEcf, gstime functions
- **Performance**: Comparable to python-sgp4 (faster than Skyfield)
- **Accuracy**: Should match python-skyfield closely

## Output Format

Standard format matching other implementations:

```json
{
  "testCase": "001_iss_nyc",
  "implementation": "javascript-satellite.js",
  "version": "1.0.0",
  "visibilityWindows": [...],
  "executionTime": 0.123,
  "timestamp": "2024-10-26T14:30:00Z",
  "metadata": {
    "libraryName": "satellite.js",
    "libraryVersion": "5.0.0",
    "platform": "Node.js v18.x.x"
  }
}
```

## Testing

```bash
# Build and run with Docker
docker build -t visibility-test/javascript-satellite.js .
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/javascript-satellite.js 001_iss_nyc

# Check output
cat ../../results/javascript-satellite.js_001_iss_nyc.json

# Validate with orchestrator
cd ../../test-runner
./target/release/visibility-test-runner validate --implementation javascript-satellite.js
```

## Known Limitations

- Range rate uses finite differences (less accurate than analytical)
- No atmospheric refraction correction
- Relies on satellite.js accuracy for ECI/ECEF transformations

## Performance

Expected performance:
- Similar to python-sgp4 (~0.5-1s per test case)
- Significantly faster than python-skyfield

## Version History

- 1.0.0 (2024-10-26) - Initial implementation

## License

Same as parent project.
