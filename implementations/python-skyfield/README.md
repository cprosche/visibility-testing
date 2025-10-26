# Python Skyfield Implementation

Primary reference implementation for satellite visibility calculations using the Skyfield library.

## Overview

This implementation uses [Skyfield](https://rhodesmill.org/skyfield/), a high-precision astronomy library that provides accurate satellite position calculations using the SGP4 propagator.

**Status**: Primary Reference Implementation - All other implementations are validated against this one.

## Features

- SGP4 satellite propagation
- Precise topocentric coordinate calculations
- Visibility window detection
- Azimuth, elevation, range, and range rate calculations
- Satellite altitude above Earth's surface

## Dependencies

- Python 3.11+
- Skyfield 1.49
- NumPy 1.26.4

## Usage

### Docker (Recommended)

```bash
# Build image
docker build -t visibility-test/python-skyfield .

# Run all test cases
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/python-skyfield

# Run specific test case
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/python-skyfield 001_iss_nyc
```

### Native Python

```bash
# Install dependencies
pip install -r requirements.txt

# Run all test cases
python src/main.py

# Run specific test case
python src/main.py 001_iss_nyc
```

## Output Format

Results are written to `/results/python-skyfield_{testcase}.json`:

```json
{
  "testCase": "001_iss_nyc",
  "implementation": "python-skyfield",
  "version": "1.0.0",
  "visibilityWindows": [
    {
      "start": "2024-01-01T06:23:10Z",
      "end": "2024-01-01T06:30:40Z",
      "maxElevation": 68.5,
      "maxElevationTime": "2024-01-01T06:27:00Z",
      "duration": 450,
      "points": [
        {
          "time": "2024-01-01T06:23:10Z",
          "azimuth": 342.5,
          "elevation": 10.2,
          "range": 1423.7,
          "rangeRate": -5.234,
          "altitude": 418.2
        }
      ]
    }
  ],
  "executionTime": 0.042,
  "timestamp": "2024-01-26T12:00:00Z",
  "metadata": {
    "libraryName": "skyfield",
    "libraryVersion": "1.49",
    "platform": "Python 3.11.5"
  }
}
```

## Implementation Details

### Coordinate Systems

- **Azimuth**: 0° = North, 90° = East, 180° = South, 270° = West
- **Elevation**: Angle above horizon (0° = horizon, 90° = zenith)
- **Range**: Distance from observer to satellite in kilometers
- **Range Rate**: Rate of change of range in km/s (negative = approaching)

### Visibility Detection

A satellite is considered visible when:
1. Elevation angle ≥ minimum elevation threshold (from test case)
2. Continuous visibility windows are detected by tracking elevation over time

### Accuracy

Skyfield provides sub-kilometer accuracy for satellite positions when using up-to-date TLE data. This implementation serves as the reference because:
- Well-maintained and actively developed
- Thoroughly tested against real observations
- Uses high-precision astronomical calculations
- Properly accounts for Earth's shape and atmospheric effects

## File Structure

```
python-skyfield/
├── Dockerfile              # Docker image definition
├── requirements.txt        # Python dependencies
├── README.md              # This file
└── src/
    ├── main.py            # Entry point and CLI
    └── calculator.py      # Core visibility calculations
```

## Testing

To verify the implementation:

```bash
# Run single test
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/python-skyfield 001_iss_nyc

# Check output
cat ../../results/python-skyfield_001_iss_nyc.json
```

## Known Limitations

- Requires internet connection on first run to download Earth orientation data (cached after)
- TLE accuracy degrades over time from epoch
- Does not account for atmospheric refraction (follows SGP4 standard)
- Does not include visual magnitude calculations

## Version History

- 1.0.0 (2024-01) - Initial implementation
