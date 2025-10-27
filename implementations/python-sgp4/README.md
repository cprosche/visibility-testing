# Python SGP4 Implementation

Alternative implementation using the pure Python sgp4 library directly for satellite visibility calculations.

## Overview

This implementation uses the [sgp4](https://github.com/brandon-rhodes/python-sgp4) library, which provides a pure Python implementation of the SGP4 satellite propagation algorithm. Unlike Skyfield, this library is lower-level and requires manual coordinate transformations.

**Status**: Functional - Coordinate transformation fixed, 100% window detection match with reference.

## Features

- Pure Python SGP4 propagation
- Manual ECEF to topocentric coordinate transformations
- Visibility window detection
- Azimuth, elevation, range, and range rate calculations
- Geodetic to ECEF conversions

## Dependencies

- Python 3.11+
- sgp4 2.25
- NumPy 1.26.4

## Usage

### Docker (Recommended)

```bash
# Build image
docker build -t visibility-test/python-sgp4 .

# Run all test cases
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/python-sgp4

# Run specific test case
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/python-sgp4 001_iss_nyc
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

## Implementation Details

### Coordinate Transformations

This implementation performs manual coordinate transformations:

1. **Geodetic to ECEF**: Observer location converted from lat/lon/altitude to Earth-Centered, Earth-Fixed coordinates
2. **SGP4 Propagation**: Satellite position calculated in TEME (True Equator Mean Equinox) frame
3. **TEME to ECEF**: Proper transformation using GMST (Greenwich Mean Sidereal Time) rotation
4. **ECEF to Topocentric**: Range vector transformed to South-East-Zenith (SEZ) frame
5. **SEZ to Az/El**: Final conversion to azimuth and elevation angles

### Key Differences from Skyfield

- **Lower-level API**: Requires manual coordinate transformations
- **TEME→ECEF**: Implements GMST rotation (Skyfield includes additional precession/nutation/polar motion)
- **Performance**: ~45x faster than Skyfield
- **Accuracy**: Visibility windows match 100%; absolute position accuracy ~0.5-1° and ~5km

### Accuracy Considerations

- TEME to ECEF transformation uses GMST rotation (standard IAU formula)
- Missing precession, nutation, and polar motion corrections (vs. Skyfield)
- Suitable for visibility window detection; use Skyfield for high-precision applications
- Typical accuracy: ~0.5-1° in azimuth/elevation, ~5km in range

## Output Format

Same as python-skyfield:

```json
{
  "testCase": "001_iss_nyc",
  "implementation": "python-sgp4",
  "version": "1.0.0",
  "visibilityWindows": [...],
  "executionTime": 0.035,
  "timestamp": "2024-10-26T09:05:00Z",
  "metadata": {
    "libraryName": "sgp4",
    "libraryVersion": "2.25",
    "platform": "Python 3.11"
  }
}
```

## File Structure

```
python-sgp4/
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
  visibility-test/python-sgp4 001_iss_nyc

# Check output
cat ../../results/python-sgp4_001_iss_nyc.json

# Compare with reference
diff ../../results/python-sgp4_001_iss_nyc.json \
     ../../test-data/reference-results/python-skyfield_001_iss_nyc.json
```

## Known Limitations

- Missing precession, nutation, and polar motion corrections
- Does not account for atmospheric refraction
- Range rate calculation uses finite differences (less accurate than analytical)
- No built-in Earth orientation parameter handling

## Performance

Significantly faster than Skyfield:
- Skyfield: ~1.8 seconds per test case
- SGP4: ~0.04 seconds per test case (~45x faster)

Trade-off: Faster but less precise; good for visibility window detection, use Skyfield for high-precision work.

## Version History

- 1.0.1 (2024-10-26) - Fixed TEME to ECEF coordinate transformation with proper GMST rotation
- 1.0.0 (2024-01) - Initial implementation
