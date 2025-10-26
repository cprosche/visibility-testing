# Validation Tolerance Specification

This document defines the acceptable tolerances when comparing satellite visibility calculation results across different implementations.

## Overview

Different programming languages, libraries, and numerical methods may produce slightly different results due to:
- Floating-point precision differences
- Platform-specific math libraries
- Algorithmic variations in SGP4 implementations
- Different approaches to coordinate transformations
- Variations in time system conversions

These tolerances define what constitutes "acceptable agreement" between implementations.

## Tolerance Values

| Parameter | Tolerance | Unit | Rationale |
|-----------|-----------|------|-----------|
| Azimuth | ±0.1 | degrees | Atmospheric refraction variability |
| Elevation | ±0.1 | degrees | Propagation model differences |
| Range | ±1.0 | kilometers | TLE accuracy limitations |
| Time | ±1.0 | seconds | Discrete time step sampling |
| Range Rate | ±0.1 | km/s | Numerical differentiation error |
| Altitude | ±1.0 | kilometers | TLE accuracy and model differences |

## Detailed Rationale

### Azimuth (±0.1°)

**Why this tolerance:**
- Atmospheric refraction can cause apparent position shifts of up to 0.05° near the horizon
- Different libraries may handle coordinate frame transformations slightly differently
- Numerical precision in trigonometric calculations varies by platform

**Physical significance:**
- At 1000 km range, 0.1° ≈ 1.7 km cross-track displacement
- This is well within the practical accuracy needs for visibility predictions

**When stricter tolerance may be needed:**
- High-precision pointing applications (use ±0.01° if required)
- When comparing against high-fidelity ephemerides (not TLE-based)

### Elevation (±0.1°)

**Why this tolerance:**
- Atmospheric refraction effects are strongest near the horizon (up to 0.5° at 0° elevation)
- SGP4 model variations between implementations can differ by ~0.05°
- Different geoid models (if used) can contribute small differences

**Physical significance:**
- Critical for determining visibility windows (satellite rising/setting times)
- At 1000 km range, 0.1° ≈ 1.7 km altitude difference in line-of-sight

**Special considerations:**
- Near-horizon passes (elevation < 5°) may have larger actual variations due to refraction
- For applications requiring strict horizon definitions, consider using minElevation ≥ 5°

### Range (±1.0 km)

**Why this tolerance:**
- TLE data itself has inherent accuracy limitations of ~1 km for LEO satellites
- TLE epoch age affects accuracy (degrades over time from epoch)
- SGP4 model is a simplified perturbation model, not a high-fidelity integrator

**Physical significance:**
- Relative error: ~0.1-0.2% for typical LEO satellites (400-2000 km altitude)
- More than sufficient for visibility predictions and most tracking applications

**TLE accuracy by orbit type:**
- LEO (200-2000 km): ±0.5-2 km typical
- MEO (2000-35786 km): ±1-5 km typical
- GEO (35786 km): ±2-10 km typical

**When stricter tolerance may be needed:**
- High-precision orbit determination (use high-fidelity ephemerides, not TLE)
- Conjunction analysis (requires specialized tools)

### Time (±1.0 second)

**Why this tolerance:**
- Discrete time stepping means exact event times are interpolated
- Different implementations may use different interpolation methods
- Visibility window boundaries depend on the discrete sampling rate

**Physical significance:**
- For fast-moving LEO satellites (~7.5 km/s), 1 second ≈ 7.5 km displacement
- Combined with elevation tolerance, this defines visibility window boundaries adequately

**Relationship to time step:**
- Test cases use time steps of 1-60 seconds depending on orbit type
- Tolerance should be ≤ time step used in the test case
- For step=10s, ±1s tolerance means ±10% uncertainty in window boundaries

**Special considerations:**
- High-frequency sampling test cases (step=1s) may reveal platform time handling differences
- Time system conversions (UTC, UT1, TAI, TT) can introduce sub-second differences

### Range Rate (±0.1 km/s)

**Why this tolerance:**
- Range rate is typically computed via numerical differentiation
- Different finite difference methods yield slightly different results
- Derivatives amplify small position errors

**Physical significance:**
- For Doppler shift calculations: 0.1 km/s ≈ 334 Hz at L-band (1.5 GHz)
- Sign indicates approach (negative) or recession (positive)

**Calculation methods:**
- Forward difference: v(t) ≈ [r(t+Δt) - r(t)] / Δt
- Central difference: v(t) ≈ [r(t+Δt) - r(t-Δt)] / (2Δt)
- Analytic: Some libraries compute velocity directly from orbital elements

**When stricter tolerance may be needed:**
- Doppler tracking applications (consider ±0.01 km/s)
- Radio frequency predictions for communications

### Altitude (±1.0 km)

**Why this tolerance:**
- Satellite altitude is derived from position calculations
- Subject to same TLE accuracy limitations as range
- Geoid vs. ellipsoid height differences can be ~100m

**Physical significance:**
- Altitude is measured from Earth's surface (geoid or ellipsoid)
- Different implementations may use different Earth models

**Special considerations:**
- Mean sea level vs. WGS84 ellipsoid can differ significantly in some regions
- For consistency, all implementations should use the same Earth model

## Validation Logic

### Comparing Single Values

For any single measurement (azimuth, elevation, range, etc.), results are considered matching if:

```
|value_implementation - value_reference| ≤ tolerance
```

### Comparing Visibility Windows

Two visibility windows are considered matching if:

1. **Start times** agree within ±1.0 second
2. **End times** agree within ±1.0 second
3. **Max elevation** agrees within ±0.1°
4. **Max elevation time** agrees within ±1.0 second

### Comparing Complete Results

For a test case to pass validation:

1. **Same number of visibility windows** detected
2. **Each window** matches according to above criteria
3. **If detailed points are provided**, at least 95% of points must match within tolerances

**Handling edge cases:**
- If reference has N windows and implementation has N±1 windows, investigate:
  - Is there a window near the minElevation threshold?
  - Does one implementation detect a marginal pass the other misses?
  - This may indicate the tolerance is too strict for that scenario

## Failure Analysis

### When implementations disagree beyond tolerances:

1. **Check TLE data**: Ensure all implementations use identical TLE strings
2. **Check time system**: Verify all times are in UTC and properly formatted
3. **Check coordinate conventions**: Confirm azimuth/elevation definitions match
4. **Check observer position**: Ensure lat/lon/alt are identical
5. **Check SGP4 algorithm**: Verify both use standard SGP4 (not SDP4 for deep space)
6. **Platform differences**: Test on different platforms to identify system-dependent issues

### Common sources of discrepancy:

- **Coordinate frame errors**: Different definitions of North, azimuth=0
- **Elevation vs. altitude confusion**: Elevation is angle, altitude is height
- **Degree vs. radian errors**: Trigonometric function input/output units
- **Earth model differences**: Different equatorial radius or flattening constants
- **Time zone issues**: Not converting to UTC properly
- **Floating-point rounding**: Different precision in intermediate calculations

## Updating Tolerances

These tolerances are based on practical experience and typical use cases. They may be adjusted if:

1. **Community consensus**: Multiple implementations consistently agree to tighter tolerances
2. **Use case requirements**: Specific applications need higher precision
3. **Library improvements**: Better SGP4 implementations reduce inherent variations

**Process for changing tolerances:**
1. Propose change in GitHub issue with justification
2. Run full test suite with new tolerances
3. Analyze failure modes and edge cases
4. Document any test cases that become invalid with new tolerances
5. Update this specification and `schema.json` if needed

## Testing Tolerance Boundaries

The test suite should include cases that specifically test tolerance boundaries:

- **Near-threshold elevation**: Passes with max elevation just above minElevation
- **Grazing passes**: Low maximum elevation to test azimuth accuracy
- **High-frequency sampling**: 1-second time steps to test time handling
- **Multi-day windows**: Extended periods to test TLE degradation

## Performance vs. Accuracy Tradeoffs

Implementations may offer different accuracy modes:

- **Fast mode**: May sacrifice precision for speed (still must meet tolerances)
- **Precise mode**: Higher internal precision, slower execution
- **Default mode**: Balance of speed and accuracy

All modes must pass validation within these tolerances. Implementations should document which mode is used in the output metadata.

## References

- Vallado, D. A., et al. "Revisiting Spacetrack Report #3" (2006) - SGP4 accuracy analysis
- Kelso, T.S. "Validation of SGP4 and IS-GPS-200D" - TLE accuracy studies
- Astronomical Almanac - Coordinate system transformations and refraction
- IERS Conventions - Time system definitions and Earth orientation

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-01 | Initial tolerance specification |
