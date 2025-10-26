use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sgp4::*;
use std::f64::consts::PI;
use std::fs;
use std::path::{Path, PathBuf};

const EARTH_RADIUS_KM: f64 = 6378.137;
const DEG2RAD: f64 = PI / 180.0;
const RAD2DEG: f64 = 180.0 / PI;

#[derive(Debug, Deserialize)]
struct TestCase {
    name: String,
    satellite: SatelliteData,
    observer: Observer,
    #[serde(rename = "timeWindow")]
    time_window: TimeWindow,
    #[serde(rename = "minElevation")]
    min_elevation: f64,
}

#[derive(Debug, Deserialize)]
struct SatelliteData {
    tle: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct Observer {
    latitude: f64,
    longitude: f64,
    altitude: f64,
}

#[derive(Debug, Deserialize)]
struct TimeWindow {
    start: String,
    end: String,
    step: i64,
}

#[derive(Debug, Serialize)]
struct TestResult {
    #[serde(rename = "testCase")]
    test_case: String,
    implementation: String,
    version: String,
    #[serde(rename = "visibilityWindows")]
    visibility_windows: Vec<VisibilityWindow>,
    #[serde(rename = "executionTime")]
    execution_time: f64,
    timestamp: String,
    metadata: Metadata,
}

#[derive(Debug, Serialize)]
struct VisibilityWindow {
    start: String,
    end: String,
    #[serde(rename = "maxElevation")]
    max_elevation: f64,
    #[serde(rename = "maxElevationTime")]
    max_elevation_time: String,
    duration: f64,
    points: Vec<Point>,
}

#[derive(Debug, Serialize, Clone)]
struct Point {
    time: String,
    azimuth: f64,
    elevation: f64,
    range: f64,
    #[serde(rename = "rangeRate")]
    range_rate: f64,
    altitude: f64,
}

#[derive(Debug, Serialize)]
struct Metadata {
    #[serde(rename = "libraryName")]
    library_name: String,
    #[serde(rename = "libraryVersion")]
    library_version: String,
    platform: String,
}

#[derive(Debug, Clone)]
struct Position {
    time: DateTime<Utc>,
    elevation: f64,
    azimuth: f64,
    range: f64,
    range_rate: f64,
    altitude: f64,
}

struct VisibilityCalculator {
    version: String,
}

impl VisibilityCalculator {
    fn new() -> Self {
        Self {
            version: "1.0.0".to_string(),
        }
    }

    fn calculate(&self, test_case: &TestCase) -> Result<TestResult> {
        let start_time = std::time::Instant::now();

        // Parse TLE
        let elements = Elements::from_tle(
            None,
            test_case.satellite.tle[1].as_bytes(),
            test_case.satellite.tle[2].as_bytes(),
        )?;

        let constants = Constants::from_elements_afspc_compatibility_mode(&elements)?;

        // Parse time window
        let start = DateTime::parse_from_rfc3339(&test_case.time_window.start)?
            .with_timezone(&Utc);
        let end = DateTime::parse_from_rfc3339(&test_case.time_window.end)?
            .with_timezone(&Utc);
        let step = Duration::seconds(test_case.time_window.step);

        // Generate times
        let times = self.generate_times(start, end, step);

        // Calculate observer ECEF position
        let observer_ecef = self.geodetic_to_ecef(
            test_case.observer.latitude,
            test_case.observer.longitude,
            test_case.observer.altitude / 1000.0,
        );

        // Calculate positions
        let positions = self.calculate_positions(
            &constants,
            &elements,
            &times,
            &observer_ecef,
            test_case.observer.latitude,
            test_case.observer.longitude,
        )?;

        // Find visibility windows
        let visibility_windows =
            self.find_visibility_windows(&positions, test_case.min_elevation);

        let execution_time = start_time.elapsed().as_secs_f64();

        Ok(TestResult {
            test_case: test_case.name.clone(),
            implementation: "rust-sgp4".to_string(),
            version: self.version.clone(),
            visibility_windows,
            execution_time: (execution_time * 1000.0).round() / 1000.0,
            timestamp: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            metadata: Metadata {
                library_name: "sgp4".to_string(),
                library_version: "2.0".to_string(),
                platform: "Rust".to_string(),
            },
        })
    }

    fn generate_times(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        step: Duration,
    ) -> Vec<DateTime<Utc>> {
        let mut times = Vec::new();
        let mut current = start;

        while current <= end {
            times.push(current);
            current = current + step;
        }

        times
    }

    fn geodetic_to_ecef(&self, lat_deg: f64, lon_deg: f64, alt_km: f64) -> [f64; 3] {
        let lat = lat_deg * DEG2RAD;
        let lon = lon_deg * DEG2RAD;

        let f = 1.0 / 298.257223563;
        let e_sq = 2.0 * f - f * f;
        let n = EARTH_RADIUS_KM / (1.0 - e_sq * lat.sin().powi(2)).sqrt();

        let x = (n + alt_km) * lat.cos() * lon.cos();
        let y = (n + alt_km) * lat.cos() * lon.sin();
        let z = (n * (1.0 - e_sq) + alt_km) * lat.sin();

        [x, y, z]
    }

    fn calculate_positions(
        &self,
        constants: &Constants,
        elements: &Elements,
        times: &[DateTime<Utc>],
        observer_ecef: &[f64; 3],
        observer_lat: f64,
        observer_lon: f64,
    ) -> Result<Vec<Position>> {
        let mut positions = Vec::new();

        // Get TLE epoch as DateTime
        let epoch = elements.datetime;

        for (i, time) in times.iter().enumerate() {
            // Calculate minutes since TLE epoch
            let time_diff_seconds = (time.timestamp() - epoch.timestamp()) as f64;
            let minutes_since_epoch = time_diff_seconds / 60.0;

            // Propagate satellite
            let prediction = constants.propagate(sgp4::MinutesSinceEpoch(minutes_since_epoch))?;

            // Get position in TEME frame (km)
            let sat_teme = [
                prediction.position[0],
                prediction.position[1],
                prediction.position[2],
            ];

            // Convert TEME to ECEF
            let gmst = self.gmst(*time);
            let sat_ecef = self.teme_to_ecef(&sat_teme, gmst);

            // Calculate range vector
            let range_vec = [
                sat_ecef[0] - observer_ecef[0],
                sat_ecef[1] - observer_ecef[1],
                sat_ecef[2] - observer_ecef[2],
            ];

            let range = (range_vec[0].powi(2) + range_vec[1].powi(2) + range_vec[2].powi(2)).sqrt();

            // Calculate look angles
            let (azimuth, elevation) = self.ecef_to_azel(&range_vec, observer_lat, observer_lon);

            // Calculate range rate
            let range_rate = if i < times.len() - 1 {
                let next_time = times[i + 1];
                let next_time_diff_seconds = (next_time.timestamp() - epoch.timestamp()) as f64;
                let next_minutes_since_epoch = next_time_diff_seconds / 60.0;
                let next_prediction = constants.propagate(sgp4::MinutesSinceEpoch(next_minutes_since_epoch))?;

                let next_sat_teme = [
                    next_prediction.position[0],
                    next_prediction.position[1],
                    next_prediction.position[2],
                ];

                let next_gmst = self.gmst(next_time);
                let next_sat_ecef = self.teme_to_ecef(&next_sat_teme, next_gmst);

                let next_range = ((next_sat_ecef[0] - observer_ecef[0]).powi(2)
                    + (next_sat_ecef[1] - observer_ecef[1]).powi(2)
                    + (next_sat_ecef[2] - observer_ecef[2]).powi(2))
                    .sqrt();

                let time_diff = (next_time.timestamp() - time.timestamp()) as f64;
                if time_diff > 0.0 {
                    (next_range - range) / time_diff
                } else {
                    0.0
                }
            } else {
                0.0
            };

            // Calculate satellite altitude
            let sat_altitude =
                (sat_ecef[0].powi(2) + sat_ecef[1].powi(2) + sat_ecef[2].powi(2)).sqrt()
                    - EARTH_RADIUS_KM;

            positions.push(Position {
                time: *time,
                elevation,
                azimuth,
                range,
                range_rate,
                altitude: sat_altitude,
            });
        }

        Ok(positions)
    }

    fn gmst(&self, time: DateTime<Utc>) -> f64 {
        let jd = 2440587.5 + (time.timestamp() as f64 / 86400.0);
        let fr = (time.timestamp() % 86400) as f64 / 86400.0;

        let t = (jd - 2451545.0 + fr) / 36525.0;

        let gmst_0h = 24110.54841
            + 8640184.812866 * t
            + 0.093104 * t * t
            - 6.2e-6 * t * t * t;

        let gmst_0h = gmst_0h + 86400.0 * 1.00273790935 * fr;

        let gmst_rad = (gmst_0h % 86400.0) * (2.0 * PI / 86400.0);

        gmst_rad
    }

    fn teme_to_ecef(&self, teme_pos: &[f64; 3], gmst: f64) -> [f64; 3] {
        let cos_gmst = gmst.cos();
        let sin_gmst = gmst.sin();

        let x_ecef = cos_gmst * teme_pos[0] + sin_gmst * teme_pos[1];
        let y_ecef = -sin_gmst * teme_pos[0] + cos_gmst * teme_pos[1];
        let z_ecef = teme_pos[2];

        [x_ecef, y_ecef, z_ecef]
    }

    fn ecef_to_azel(
        &self,
        range_vec: &[f64; 3],
        observer_lat_deg: f64,
        observer_lon_deg: f64,
    ) -> (f64, f64) {
        let lat = observer_lat_deg * DEG2RAD;
        let lon = observer_lon_deg * DEG2RAD;

        let sin_lat = lat.sin();
        let cos_lat = lat.cos();
        let sin_lon = lon.sin();
        let cos_lon = lon.cos();

        // Transform to topocentric SEZ frame
        let south =
            sin_lat * cos_lon * range_vec[0] + sin_lat * sin_lon * range_vec[1] - cos_lat * range_vec[2];

        let east = -sin_lon * range_vec[0] + cos_lon * range_vec[1];

        let zenith = cos_lat * cos_lon * range_vec[0]
            + cos_lat * sin_lon * range_vec[1]
            + sin_lat * range_vec[2];

        // Calculate azimuth
        let mut azimuth = east.atan2(-south) * RAD2DEG;
        if azimuth < 0.0 {
            azimuth += 360.0;
        }

        // Calculate elevation
        let range_horizontal = (south.powi(2) + east.powi(2)).sqrt();
        let elevation = zenith.atan2(range_horizontal) * RAD2DEG;

        (azimuth, elevation)
    }

    fn find_visibility_windows(
        &self,
        positions: &[Position],
        min_elevation: f64,
    ) -> Vec<VisibilityWindow> {
        let mut windows = Vec::new();
        let mut in_window = false;
        let mut window_start: Option<DateTime<Utc>> = None;
        let mut window_positions = Vec::new();
        let mut window_max_elevation = -90.0;
        let mut window_max_elevation_time: Option<DateTime<Utc>> = None;

        for (i, pos) in positions.iter().enumerate() {
            if pos.elevation >= min_elevation {
                if !in_window {
                    in_window = true;
                    window_start = Some(pos.time);
                    window_positions.clear();
                    window_max_elevation = pos.elevation;
                    window_max_elevation_time = Some(pos.time);
                }

                if pos.elevation > window_max_elevation {
                    window_max_elevation = pos.elevation;
                    window_max_elevation_time = Some(pos.time);
                }

                window_positions.push(Point {
                    time: pos.time.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                    azimuth: (pos.azimuth * 100.0).round() / 100.0,
                    elevation: (pos.elevation * 100.0).round() / 100.0,
                    range: (pos.range * 100.0).round() / 100.0,
                    range_rate: (pos.range_rate * 1000.0).round() / 1000.0,
                    altitude: (pos.altitude * 100.0).round() / 100.0,
                });
            } else if in_window {
                // End of window
                let window_end = positions[i - 1].time;
                let duration = (window_end - window_start.unwrap()).num_seconds() as f64;

                windows.push(VisibilityWindow {
                    start: window_start.unwrap().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                    end: window_end.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                    max_elevation: (window_max_elevation * 100.0).round() / 100.0,
                    max_elevation_time: window_max_elevation_time
                        .unwrap()
                        .format("%Y-%m-%dT%H:%M:%SZ")
                        .to_string(),
                    duration,
                    points: window_positions.clone(),
                });

                in_window = false;
                window_positions.clear();
            }
        }

        // Handle window extending to end
        if in_window && !window_positions.is_empty() {
            let window_end = positions.last().unwrap().time;
            let duration = (window_end - window_start.unwrap()).num_seconds() as f64;

            windows.push(VisibilityWindow {
                start: window_start.unwrap().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                end: window_end.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                max_elevation: (window_max_elevation * 100.0).round() / 100.0,
                max_elevation_time: window_max_elevation_time
                    .unwrap()
                    .format("%Y-%m-%dT%H:%M:%SZ")
                    .to_string(),
                duration,
                points: window_positions,
            });
        }

        windows
    }
}

fn main() -> Result<()> {
    // Configuration
    let test_data_dir = if Path::new("/test-data/cases").exists() {
        PathBuf::from("/test-data/cases")
    } else {
        PathBuf::from("../../test-data/cases")
    };

    let results_dir = if Path::new("/results").exists() {
        PathBuf::from("/results")
    } else {
        PathBuf::from("../../results")
    };

    fs::create_dir_all(&results_dir)?;

    // Get test cases
    let args: Vec<String> = std::env::args().collect();
    let test_files: Vec<PathBuf> = if args.len() > 1 {
        vec![test_data_dir.join(format!("{}.json", args[1]))]
    } else {
        let mut files: Vec<PathBuf> = fs::read_dir(&test_data_dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |ext| ext == "json"))
            .collect();
        files.sort();
        files
    };

    println!("Rust SGP4 Satellite Visibility Calculator");
    println!("{}", "=".repeat(50));
    println!("Test data directory: {}", test_data_dir.display());
    println!("Results directory: {}", results_dir.display());
    println!("Found {} test case(s)", test_files.len());
    println!();

    let calculator = VisibilityCalculator::new();

    for test_file in &test_files {
        println!("Processing: {}", test_file.file_name().unwrap().to_string_lossy());

        let content = fs::read_to_string(test_file)
            .context(format!("Failed to read {}", test_file.display()))?;

        let test_case: TestCase = serde_json::from_str(&content)
            .context(format!("Failed to parse {}", test_file.display()))?;

        let result = calculator.calculate(&test_case)?;

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let output_file = results_dir.join(format!("rust-sgp4_{}_{}.json", result.test_case, timestamp));
        fs::write(&output_file, serde_json::to_string_pretty(&result)?)?;

        println!("✓ Wrote results to {}", output_file.display());
        println!("  Execution time: {:.3}s", result.execution_time);
        println!("  Visibility windows: {}", result.visibility_windows.len());
        println!();
    }

    println!("✓ Successfully processed {} test case(s)", test_files.len());

    Ok(())
}
