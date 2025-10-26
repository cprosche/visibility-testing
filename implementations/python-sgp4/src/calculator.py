"""
Visibility Calculator using pure SGP4 library.
"""

from datetime import datetime, timedelta
from sgp4.api import Satrec, jday, SGP4_ERRORS
from sgp4 import exporter
import numpy as np
import math


class VisibilityCalculator:
    """Calculate satellite visibility using SGP4 library."""

    # Earth constants
    EARTH_RADIUS_KM = 6378.137  # WGS84 equatorial radius
    EARTH_FLATTENING = 1.0 / 298.257223563  # WGS84 flattening

    def __init__(self):
        """Initialize the calculator."""
        pass

    def get_version(self):
        """Get SGP4 version."""
        import sgp4
        return sgp4.__version__

    def calculate(self, test_case):
        """
        Calculate visibility for a test case.

        Args:
            test_case: Dictionary with test case data

        Returns:
            Dictionary with visibility results
        """
        # Extract test case parameters
        name = test_case['name']
        tle_lines = test_case['satellite']['tle']
        observer_data = test_case['observer']
        time_window = test_case['timeWindow']
        min_elevation = test_case['minElevation']

        # Create satellite from TLE
        satellite = Satrec.twoline2rv(tle_lines[1], tle_lines[2])

        # Parse time window
        start_time = datetime.fromisoformat(time_window['start'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(time_window['end'].replace('Z', '+00:00'))
        step_seconds = time_window['step']

        # Generate time array
        times = self._generate_times(start_time, end_time, step_seconds)

        # Calculate observer ECEF position
        observer_ecef = self._geodetic_to_ecef(
            observer_data['latitude'],
            observer_data['longitude'],
            observer_data['altitude'] / 1000.0  # Convert to km
        )

        # Calculate positions for all times
        positions = self._calculate_positions(satellite, observer_ecef, times,
                                             observer_data['latitude'],
                                             observer_data['longitude'])

        # Find visibility windows
        visibility_windows = self._find_visibility_windows(
            positions, times, min_elevation
        )

        # Build result
        result = {
            'testCase': name,
            'implementation': 'python-sgp4',
            'version': '1.0.0',
            'visibilityWindows': visibility_windows
        }

        return result

    def _generate_times(self, start, end, step_seconds):
        """Generate array of times from start to end with given step."""
        times = []
        current = start
        while current <= end:
            times.append(current)
            current += timedelta(seconds=step_seconds)
        return times

    def _geodetic_to_ecef(self, lat_deg, lon_deg, alt_km):
        """Convert geodetic coordinates to ECEF (Earth-Centered, Earth-Fixed)."""
        lat = math.radians(lat_deg)
        lon = math.radians(lon_deg)

        # Calculate radius of curvature
        e_squared = 2 * self.EARTH_FLATTENING - self.EARTH_FLATTENING ** 2
        N = self.EARTH_RADIUS_KM / math.sqrt(1 - e_squared * math.sin(lat) ** 2)

        # Calculate ECEF coordinates
        x = (N + alt_km) * math.cos(lat) * math.cos(lon)
        y = (N + alt_km) * math.cos(lat) * math.sin(lon)
        z = (N * (1 - e_squared) + alt_km) * math.sin(lat)

        return np.array([x, y, z])

    def _gmst(self, jd, fr):
        """
        Calculate Greenwich Mean Sidereal Time (GMST) in radians.

        Args:
            jd: Julian day number
            fr: Fractional day

        Returns:
            GMST in radians
        """
        # Calculate Julian centuries from J2000.0
        t = (jd - 2451545.0 + fr) / 36525.0

        # GMST at 0h UT (in seconds)
        gmst_0h = 24110.54841 + 8640184.812866 * t + 0.093104 * t * t - 6.2e-6 * t * t * t

        # Add contribution from fractional day
        gmst_0h += 86400.0 * 1.00273790935 * fr

        # Convert to radians and normalize to [0, 2π]
        gmst_rad = (gmst_0h % 86400.0) * (2.0 * math.pi / 86400.0)

        return gmst_rad

    def _teme_to_ecef(self, teme_pos, jd, fr):
        """
        Convert TEME (True Equator Mean Equinox) to ECEF coordinates.

        Args:
            teme_pos: Position vector in TEME frame (km)
            jd: Julian day number
            fr: Fractional day

        Returns:
            Position vector in ECEF frame (km)
        """
        # Get Greenwich Mean Sidereal Time
        gmst = self._gmst(jd, fr)

        # Rotation matrix from TEME to PEF (Pseudo-Earth Fixed)
        # This is essentially a rotation about the Z-axis by GMST
        cos_gmst = math.cos(gmst)
        sin_gmst = math.sin(gmst)

        # Apply rotation
        x_ecef = cos_gmst * teme_pos[0] + sin_gmst * teme_pos[1]
        y_ecef = -sin_gmst * teme_pos[0] + cos_gmst * teme_pos[1]
        z_ecef = teme_pos[2]

        return np.array([x_ecef, y_ecef, z_ecef])

    def _calculate_positions(self, satellite, observer_ecef, times, observer_lat, observer_lon):
        """Calculate satellite positions for all times."""
        positions = []

        for i, dt in enumerate(times):
            # Convert datetime to Julian date
            jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)

            # Get satellite position and velocity in TEME (True Equator Mean Equinox)
            error_code, sat_pos_teme, sat_vel_teme = satellite.sgp4(jd, fr)

            if error_code != 0:
                # Skip this point if SGP4 fails
                continue

            # Convert TEME to ECEF
            sat_pos_ecef = self._teme_to_ecef(np.array(sat_pos_teme), jd, fr)

            # Calculate range vector from observer to satellite
            range_vec = sat_pos_ecef - observer_ecef
            range_km = np.linalg.norm(range_vec)

            # Calculate topocentric coordinates (Az/El)
            az, el = self._ecef_to_azel(range_vec, observer_lat, observer_lon)

            # Calculate range rate
            if i < len(times) - 1:
                # Use next position to calculate rate
                dt_next = times[i + 1]
                jd_next, fr_next = jday(dt_next.year, dt_next.month, dt_next.day,
                                       dt_next.hour, dt_next.minute, dt_next.second)
                error_code_next, sat_pos_next_teme, _ = satellite.sgp4(jd_next, fr_next)

                if error_code_next == 0:
                    sat_pos_next_ecef = self._teme_to_ecef(np.array(sat_pos_next_teme), jd_next, fr_next)
                    range_next = np.linalg.norm(sat_pos_next_ecef - observer_ecef)
                    time_diff = (times[i + 1] - dt).total_seconds()
                    range_rate = (range_next - range_km) / time_diff if time_diff > 0 else 0.0
                else:
                    range_rate = 0.0
            else:
                range_rate = 0.0

            # Calculate satellite altitude
            sat_altitude = np.linalg.norm(sat_pos_ecef) - self.EARTH_RADIUS_KM

            positions.append({
                'time': dt,
                'elevation': el,
                'azimuth': az,
                'range': range_km,
                'rangeRate': range_rate,
                'altitude': sat_altitude
            })

        return positions

    def _ecef_to_azel(self, range_vec, observer_lat_deg, observer_lon_deg):
        """
        Convert ECEF range vector to azimuth and elevation.

        Args:
            range_vec: Range vector from observer to satellite in ECEF
            observer_lat_deg: Observer latitude in degrees
            observer_lon_deg: Observer longitude in degrees

        Returns:
            tuple: (azimuth, elevation) in degrees
        """
        lat = math.radians(observer_lat_deg)
        lon = math.radians(observer_lon_deg)

        # Rotation matrix from ECEF to topocentric (SEZ)
        # SEZ = South-East-Zenith
        sin_lat = math.sin(lat)
        cos_lat = math.cos(lat)
        sin_lon = math.sin(lon)
        cos_lon = math.cos(lon)

        # Transform to topocentric frame
        south = (sin_lat * cos_lon * range_vec[0] +
                sin_lat * sin_lon * range_vec[1] -
                cos_lat * range_vec[2])

        east = (-sin_lon * range_vec[0] +
                cos_lon * range_vec[1])

        zenith = (cos_lat * cos_lon * range_vec[0] +
                 cos_lat * sin_lon * range_vec[1] +
                 sin_lat * range_vec[2])

        # Calculate azimuth (clockwise from North)
        azimuth = math.atan2(east, -south)
        azimuth_deg = math.degrees(azimuth)
        if azimuth_deg < 0:
            azimuth_deg += 360.0

        # Calculate elevation
        range_horizontal = math.sqrt(south**2 + east**2)
        elevation_deg = math.degrees(math.atan2(zenith, range_horizontal))

        return azimuth_deg, elevation_deg

    def _find_visibility_windows(self, positions, times, min_elevation):
        """Find continuous visibility windows above minimum elevation."""
        windows = []
        in_window = False
        window_start = None
        window_positions = []
        window_max_elevation = -90
        window_max_elevation_time = None

        for i, pos in enumerate(positions):
            if pos['elevation'] >= min_elevation:
                if not in_window:
                    # Start of new window
                    in_window = True
                    window_start = pos['time']
                    window_positions = []
                    window_max_elevation = pos['elevation']
                    window_max_elevation_time = pos['time']

                # Track maximum elevation
                if pos['elevation'] > window_max_elevation:
                    window_max_elevation = pos['elevation']
                    window_max_elevation_time = pos['time']

                # Add position to window
                window_positions.append({
                    'time': pos['time'].strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'azimuth': round(pos['azimuth'], 2),
                    'elevation': round(pos['elevation'], 2),
                    'range': round(pos['range'], 2),
                    'rangeRate': round(pos['rangeRate'], 3),
                    'altitude': round(pos['altitude'], 2)
                })

            else:
                if in_window:
                    # End of window
                    window_end = positions[i-1]['time']
                    duration = (window_end - window_start).total_seconds()

                    windows.append({
                        'start': window_start.strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'end': window_end.strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'maxElevation': round(window_max_elevation, 2),
                        'maxElevationTime': window_max_elevation_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'duration': round(duration, 0),
                        'points': window_positions
                    })

                    in_window = False

        # Handle case where window extends to end of time range
        if in_window and window_positions:
            window_end = positions[-1]['time']
            duration = (window_end - window_start).total_seconds()

            windows.append({
                'start': window_start.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'end': window_end.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'maxElevation': round(window_max_elevation, 2),
                'maxElevationTime': window_max_elevation_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'duration': round(duration, 0),
                'points': window_positions
            })

        return windows
