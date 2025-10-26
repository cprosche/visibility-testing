# Test Data Format Documentation

This directory contains test cases and reference results for satellite visibility calculations.

## Directory Structure

```
test-data/
├── schema.json           # JSON Schema defining the data format
├── cases/                # Input test cases (what implementations should process)
│   ├── 001_iss_nyc.json
│   ├── 002_starlink_sf.json
│   └── ...
└── reference-results/    # Expected outputs from reference implementation
    ├── 001_iss_nyc.json  (to be generated in Phase 2)
    └── ...
```

## Test Case Input Format

Each test case in `cases/` is a JSON file following this structure:

### Required Fields

- **name** (string): Unique identifier for the test case (should match filename)
- **description** (string): Human-readable explanation of what this test validates
- **satellite** (object): Satellite orbital elements
  - **tle** (array[3]): Two-Line Element set in standard NORAD format
    - Line 0: Satellite name
    - Line 1: TLE line 1 (69 characters)
    - Line 2: TLE line 2 (69 characters)
  - **name** (string, optional): Friendly name for the satellite
- **observer** (object): Observer location on Earth
  - **latitude** (number): Latitude in decimal degrees (-90 to 90)
  - **longitude** (number): Longitude in decimal degrees (-180 to 180)
  - **altitude** (number): Altitude above sea level in meters
  - **name** (string, optional): Friendly name for the location
- **timeWindow** (object): Time range for calculations
  - **start** (string): Start time in ISO 8601 format (UTC), e.g., "2024-01-01T00:00:00Z"
  - **end** (string): End time in ISO 8601 format (UTC)
  - **step** (number): Time step in seconds between calculations (1-3600)
- **minElevation** (number): Minimum elevation angle in degrees for visibility threshold

### Optional Fields

- **metadata** (object): Additional categorization information
  - **orbitType** (string): "LEO", "MEO", "GEO", or "HEO"
  - **tags** (array[string]): Tags for categorizing test cases
  - **difficulty** (string): "basic", "intermediate", "advanced", or "edge-case"

### Example Input Test Case

```json
{
  "name": "001_iss_nyc",
  "description": "ISS visibility passes over New York City during 24-hour period",
  "satellite": {
    "name": "ISS (ZARYA)",
    "tle": [
      "ISS (ZARYA)",
      "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005",
      "2 25544  51.6400 247.4627 0001320  67.4605 292.6523 15.54225995123456"
    ]
  },
  "observer": {
    "name": "New York City",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "altitude": 10
  },
  "timeWindow": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z",
    "step": 10
  },
  "minElevation": 10.0,
  "metadata": {
    "orbitType": "LEO",
    "tags": ["ISS", "urban", "multi-pass"],
    "difficulty": "basic"
  }
}
```

## Expected Output Format

Each implementation must produce results in this standardized format:

### Required Fields

- **testCase** (string): Name of the test case (matches input name)
- **implementation** (string): Implementation identifier ("python", "javascript", "rust", "cpp", "csharp")
- **version** (string): Version of the implementation (e.g., "1.0.0")
- **visibilityWindows** (array): List of visibility windows
  - **start** (string): Window start time (ISO 8601 UTC)
  - **end** (string): Window end time (ISO 8601 UTC)
  - **maxElevation** (number): Maximum elevation during this pass (degrees)
  - **maxElevationTime** (string): Time of maximum elevation (ISO 8601 UTC)
  - **duration** (number, optional): Duration in seconds
  - **points** (array, optional): Detailed visibility points
    - **time** (string): Observation time (ISO 8601 UTC)
    - **azimuth** (number): Azimuth angle in degrees (0-360, 0=North, 90=East)
    - **elevation** (number): Elevation angle in degrees (-90 to 90)
    - **range** (number): Range to satellite in kilometers
    - **rangeRate** (number, optional): Range rate in km/s
    - **altitude** (number, optional): Satellite altitude in km

### Optional Fields

- **executionTime** (number): Execution time in seconds
- **timestamp** (string): When result was generated (ISO 8601 UTC)
- **metadata** (object): Additional execution information
  - **libraryName** (string): Name of SGP4 library used
  - **libraryVersion** (string): Version of library
  - **platform** (string): Platform/OS information

### Example Output

```json
{
  "testCase": "001_iss_nyc",
  "implementation": "python",
  "version": "1.0.0",
  "visibilityWindows": [
    {
      "start": "2024-01-01T06:23:15Z",
      "end": "2024-01-01T06:30:42Z",
      "maxElevation": 68.5,
      "maxElevationTime": "2024-01-01T06:27:01Z",
      "duration": 447,
      "points": [
        {
          "time": "2024-01-01T06:23:15Z",
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
  "timestamp": "2024-01-01T12:00:00Z",
  "metadata": {
    "libraryName": "skyfield",
    "libraryVersion": "1.45",
    "platform": "Python 3.11.5 on macOS"
  }
}
```

## Current Test Cases

| Test Case | Description | Orbit Type | Difficulty | Key Features |
|-----------|-------------|------------|------------|--------------|
| 001_iss_nyc | ISS over New York City (24h) | LEO | Basic | Multi-pass, urban location |
| 002_starlink_sf | Starlink over San Francisco | LEO | Basic | Constellation satellite, coastal |
| 003_gps_denver | GPS over Denver | MEO | Intermediate | High-altitude observer (1609m) |
| 004_geo_satellite | GOES-16 over Miami | GEO | Intermediate | Geostationary (appears stationary) |
| 005_iss_equator | ISS over Singapore | LEO | Edge-case | Equatorial observer, polar orbit |
| 006_low_elevation | NOAA-18 over Anchorage | LEO | Edge-case | 0° elevation, atmospheric refraction |
| 007_polar_orbit | Landsat 8 over London | LEO | Intermediate | Sun-synchronous polar orbit |
| 008_high_frequency | ISS zenith pass over Houston | LEO | Advanced | 1-second sampling, precision test |
| 009_southern_hemisphere | ISS over Sydney | LEO | Basic | Southern hemisphere observer |
| 010_grazing_pass | Debris over Tokyo | LEO | Edge-case | Low maximum elevation |

## TLE Format Reference

Two-Line Element (TLE) sets are a standard format for representing satellite orbital elements:

**Line 0**: Satellite name (up to 24 characters)

**Line 1** (69 characters):
- Columns 1: Line number (1)
- Columns 3-7: Satellite catalog number
- Column 8: Classification (U=Unclassified)
- Columns 10-17: International designator
- Columns 19-32: Epoch (year and day of year)
- Columns 34-43: First derivative of mean motion
- Columns 45-52: Second derivative of mean motion
- Columns 54-61: BSTAR drag term
- Column 63: Ephemeris type
- Columns 65-68: Element set number
- Column 69: Checksum

**Line 2** (69 characters):
- Columns 1: Line number (2)
- Columns 3-7: Satellite catalog number
- Columns 9-16: Inclination (degrees)
- Columns 18-25: Right ascension of ascending node (degrees)
- Columns 27-33: Eccentricity (decimal point assumed)
- Columns 35-42: Argument of perigee (degrees)
- Columns 44-51: Mean anomaly (degrees)
- Columns 53-63: Mean motion (revolutions per day)
- Columns 64-68: Revolution number at epoch
- Column 69: Checksum

## Coordinate Systems

### Observer Coordinates
- **Latitude**: North is positive, South is negative (-90° to +90°)
- **Longitude**: East is positive, West is negative (-180° to +180°)
- **Altitude**: Meters above mean sea level

### Satellite Position (Topocentric)
- **Azimuth**: Degrees from North, clockwise (0°=North, 90°=East, 180°=South, 270°=West)
- **Elevation**: Degrees above horizon (0°=horizon, 90°=zenith, negative=below horizon)
- **Range**: Direct distance from observer to satellite in kilometers
- **Range Rate**: Rate of change of range in km/s (negative=approaching, positive=receding)

## Validation Criteria

When comparing implementation results against reference results, use these tolerances:

- **Azimuth**: ±0.1°
- **Elevation**: ±0.1°
- **Range**: ±1.0 km
- **Time**: ±1.0 second
- **Range Rate**: ±0.1 km/s

See `../docs/tolerance-spec.md` for detailed rationale.

## Adding New Test Cases

1. Create a new JSON file in `test-data/cases/` following the naming convention: `NNN_description.json`
2. Ensure the file validates against `schema.json`
3. Include appropriate metadata tags for categorization
4. Run the reference implementation to generate expected results
5. Document any special considerations in the description field

## Best Practices

- Use realistic TLE data (current or recent historical data)
- Choose observer locations that test different geographical scenarios
- Set appropriate time windows (don't make them unnecessarily long)
- Use reasonable time steps (1-60 seconds for LEO, 60-300 seconds for MEO/GEO)
- Include edge cases to test implementation robustness
- Add descriptive tags for easy filtering and categorization

## Schema Validation

Validate test cases against the schema:

```bash
# Using a JSON schema validator (example with ajv-cli)
ajv validate -s schema.json -d "cases/*.json"
```

## References

- [TLE Format Specification](https://celestrak.org/NORAD/documentation/tle-fmt.php)
- [SGP4 Propagator](https://en.wikipedia.org/wiki/Simplified_perturbations_models)
- [CelesTrak](https://celestrak.org/) - TLE data source
