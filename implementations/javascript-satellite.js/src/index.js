#!/usr/bin/env node

import * as satellite from 'satellite.js';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

// Constants
const EARTH_RADIUS_KM = 6378.137;
const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

class VisibilityCalculator {
  constructor() {
    this.version = '1.0.0';
  }

  calculate(testCase) {
    const { name, satellite: satData, observer, timeWindow, minElevation } = testCase;

    // Parse TLE
    const tleLine1 = satData.tle[1];
    const tleLine2 = satData.tle[2];
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

    // Parse time window
    const startTime = new Date(timeWindow.start);
    const endTime = new Date(timeWindow.end);
    const stepSeconds = timeWindow.step;

    // Generate time array
    const times = this.generateTimes(startTime, endTime, stepSeconds);

    // Calculate observer position in ECEF
    const observerEcef = this.geodeticToEcef(
      observer.latitude,
      observer.longitude,
      observer.altitude / 1000.0 // Convert to km
    );

    // Calculate positions for all times
    const positions = this.calculatePositions(
      satrec,
      times,
      observerEcef,
      observer.latitude,
      observer.longitude
    );

    // Find visibility windows
    const visibilityWindows = this.findVisibilityWindows(
      positions,
      times,
      minElevation
    );

    return {
      testCase: name,
      implementation: 'javascript-satellite.js',
      version: this.version,
      visibilityWindows
    };
  }

  generateTimes(start, end, stepSeconds) {
    const times = [];
    let current = new Date(start);

    while (current <= end) {
      times.push(new Date(current));
      current = new Date(current.getTime() + stepSeconds * 1000);
    }

    return times;
  }

  geodeticToEcef(latDeg, lonDeg, altKm) {
    const lat = latDeg * DEG2RAD;
    const lon = lonDeg * DEG2RAD;

    const a = EARTH_RADIUS_KM;
    const f = 1.0 / 298.257223563; // WGS84 flattening
    const eSq = 2 * f - f * f;
    const N = a / Math.sqrt(1 - eSq * Math.sin(lat) ** 2);

    const x = (N + altKm) * Math.cos(lat) * Math.cos(lon);
    const y = (N + altKm) * Math.cos(lat) * Math.sin(lon);
    const z = (N * (1 - eSq) + altKm) * Math.sin(lat);

    return { x, y, z };
  }

  calculatePositions(satrec, times, observerEcef, observerLat, observerLon) {
    const positions = [];

    for (let i = 0; i < times.length; i++) {
      const time = times[i];

      // Propagate satellite position
      const positionAndVelocity = satellite.propagate(satrec, time);

      if (positionAndVelocity.position === false) {
        continue; // Skip if propagation failed
      }

      const positionEci = positionAndVelocity.position;

      // Convert ECI to ECEF
      const gmst = satellite.gstime(time);
      const positionEcef = satellite.eciToEcf(positionEci, gmst);

      // Calculate range vector
      const rangeVec = {
        x: positionEcef.x - observerEcef.x,
        y: positionEcef.y - observerEcef.y,
        z: positionEcef.z - observerEcef.z
      };

      const range = Math.sqrt(
        rangeVec.x ** 2 + rangeVec.y ** 2 + rangeVec.z ** 2
      );

      // Calculate look angles
      const lookAngles = this.ecefToAzEl(rangeVec, observerLat, observerLon);

      // Calculate range rate
      let rangeRate = 0.0;
      if (i < times.length - 1) {
        const nextTime = times[i + 1];
        const nextPosVel = satellite.propagate(satrec, nextTime);

        if (nextPosVel.position !== false) {
          const nextPosEci = nextPosVel.position;
          const nextGmst = satellite.gstime(nextTime);
          const nextPosEcef = satellite.eciToEcf(nextPosEci, nextGmst);

          const nextRange = Math.sqrt(
            (nextPosEcef.x - observerEcef.x) ** 2 +
            (nextPosEcef.y - observerEcef.y) ** 2 +
            (nextPosEcef.z - observerEcef.z) ** 2
          );

          const timeDiff = (nextTime - time) / 1000.0; // seconds
          rangeRate = (nextRange - range) / timeDiff;
        }
      }

      // Calculate satellite altitude
      const satAltitude = Math.sqrt(
        positionEcef.x ** 2 + positionEcef.y ** 2 + positionEcef.z ** 2
      ) - EARTH_RADIUS_KM;

      positions.push({
        time,
        elevation: lookAngles.elevation,
        azimuth: lookAngles.azimuth,
        range,
        rangeRate,
        altitude: satAltitude
      });
    }

    return positions;
  }

  ecefToAzEl(rangeVec, observerLatDeg, observerLonDeg) {
    const lat = observerLatDeg * DEG2RAD;
    const lon = observerLonDeg * DEG2RAD;

    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const sinLon = Math.sin(lon);
    const cosLon = Math.cos(lon);

    // Transform to topocentric frame (SEZ: South-East-Zenith)
    const south = sinLat * cosLon * rangeVec.x +
                  sinLat * sinLon * rangeVec.y -
                  cosLat * rangeVec.z;

    const east = -sinLon * rangeVec.x +
                 cosLon * rangeVec.y;

    const zenith = cosLat * cosLon * rangeVec.x +
                   cosLat * sinLon * rangeVec.y +
                   sinLat * rangeVec.z;

    // Calculate azimuth (clockwise from North)
    let azimuth = Math.atan2(east, -south) * RAD2DEG;
    if (azimuth < 0) {
      azimuth += 360.0;
    }

    // Calculate elevation
    const rangeHorizontal = Math.sqrt(south ** 2 + east ** 2);
    const elevation = Math.atan2(zenith, rangeHorizontal) * RAD2DEG;

    return { azimuth, elevation };
  }

  findVisibilityWindows(positions, times, minElevation) {
    const windows = [];
    let inWindow = false;
    let windowStart = null;
    let windowPositions = [];
    let windowMaxElevation = -90;
    let windowMaxElevationTime = null;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      if (pos.elevation >= minElevation) {
        if (!inWindow) {
          // Start of new window
          inWindow = true;
          windowStart = pos.time;
          windowPositions = [];
          windowMaxElevation = pos.elevation;
          windowMaxElevationTime = pos.time;
        }

        // Track maximum elevation
        if (pos.elevation > windowMaxElevation) {
          windowMaxElevation = pos.elevation;
          windowMaxElevationTime = pos.time;
        }

        // Add position to window
        windowPositions.push({
          time: pos.time.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          azimuth: Math.round(pos.azimuth * 100) / 100,
          elevation: Math.round(pos.elevation * 100) / 100,
          range: Math.round(pos.range * 100) / 100,
          rangeRate: Math.round(pos.rangeRate * 1000) / 1000,
          altitude: Math.round(pos.altitude * 100) / 100
        });
      } else {
        if (inWindow) {
          // End of window
          const windowEnd = positions[i - 1].time;
          const duration = (windowEnd - windowStart) / 1000.0;

          windows.push({
            start: windowStart.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            end: windowEnd.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            maxElevation: Math.round(windowMaxElevation * 100) / 100,
            maxElevationTime: windowMaxElevationTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
            duration: Math.round(duration),
            points: windowPositions
          });

          inWindow = false;
        }
      }
    }

    // Handle case where window extends to end
    if (inWindow && windowPositions.length > 0) {
      const windowEnd = positions[positions.length - 1].time;
      const duration = (windowEnd - windowStart) / 1000.0;

      windows.push({
        start: windowStart.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        end: windowEnd.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        maxElevation: Math.round(windowMaxElevation * 100) / 100,
        maxElevationTime: windowMaxElevationTime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        duration: Math.round(duration),
        points: windowPositions
      });
    }

    return windows;
  }
}

function loadTestCase(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

function writeResult(result, outputDir) {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_').slice(0, 15);
  const filename = `javascript-satellite.js_${result.testCase}_${timestamp}.json`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`✓ Wrote results to ${filepath}`);
}

function main() {
  // Configuration - prefer Docker paths, fall back to local
  const testDataDir = existsSync('/test-data/cases')
    ? '/test-data/cases'
    : '../../test-data/cases';

  const resultsDir = existsSync('/results')
    ? '/results'
    : '../../results';

  // Get test case from command line or run all
  const args = process.argv.slice(2);
  let testFiles;

  if (args.length > 0) {
    const testCaseName = args[0];
    testFiles = [join(testDataDir, `${testCaseName}.json`)];
  } else {
    testFiles = readdirSync(testDataDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => join(testDataDir, f));
  }

  console.log('satellite.js Satellite Visibility Calculator');
  console.log('='.repeat(50));
  console.log(`Test data directory: ${testDataDir}`);
  console.log(`Results directory: ${resultsDir}`);
  console.log(`Found ${testFiles.length} test case(s)`);
  console.log();

  const calculator = new VisibilityCalculator();

  for (const testFile of testFiles) {
    if (!existsSync(testFile)) {
      console.error(`✗ Test file not found: ${testFile}`);
      process.exit(1);
    }

    console.log(`Processing: ${basename(testFile)}`);

    try {
      const testCase = loadTestCase(testFile);

      const startTime = Date.now();
      const result = calculator.calculate(testCase);
      const executionTime = (Date.now() - startTime) / 1000.0;

      result.executionTime = Math.round(executionTime * 1000) / 1000;
      result.timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      result.metadata = {
        libraryName: 'satellite.js',
        libraryVersion: '5.0.0',
        platform: `Node.js ${process.version}`
      };

      writeResult(result, resultsDir);

      console.log(`  Execution time: ${executionTime.toFixed(3)}s`);
      console.log(`  Visibility windows: ${result.visibilityWindows.length}`);
      console.log();
    } catch (error) {
      console.error(`✗ Error processing ${basename(testFile)}: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }

  console.log(`✓ Successfully processed ${testFiles.length} test case(s)`);
  process.exit(0);
}

main();
