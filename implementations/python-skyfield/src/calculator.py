"""
Visibility Calculator using Skyfield library.
"""

from datetime import datetime, timedelta
from skyfield.api import load, wgs84, EarthSatellite
from skyfield.timelib import Time
import numpy as np


class VisibilityCalculator:
    """Calculate satellite visibility using Skyfield."""

    def __init__(self):
        """Initialize the calculator with time scale."""
        self.ts = load.timescale()

    def get_version(self):
        """Get Skyfield version."""
        import skyfield
        return skyfield.__version__

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
        satellite = EarthSatellite(tle_lines[1], tle_lines[2], tle_lines[0], self.ts)

        # Create observer location
        observer = wgs84.latlon(
            observer_data['latitude'],
            observer_data['longitude'],
            elevation_m=observer_data['altitude']
        )

        # Parse time window
        start_time = datetime.fromisoformat(time_window['start'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(time_window['end'].replace('Z', '+00:00'))
        step_seconds = time_window['step']

        # Generate time array
        times = self._generate_times(start_time, end_time, step_seconds)

        # Calculate positions for all times
        positions = self._calculate_positions(satellite, observer, times)

        # Find visibility windows
        visibility_windows = self._find_visibility_windows(
            positions, times, min_elevation
        )

        # Build result
        result = {
            'testCase': name,
            'implementation': 'python-skyfield',
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

    def _calculate_positions(self, satellite, observer, times):
        """Calculate satellite positions for all times."""
        positions = []

        for dt in times:
            # Convert to Skyfield time
            t = self.ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)

            # Calculate difference between observer and satellite
            difference = satellite - observer
            topocentric = difference.at(t)

            # Get alt-azimuth coordinates
            alt, az, distance = topocentric.altaz()

            # Get range rate (radial velocity)
            # Calculate position at t and t+1 to get velocity
            t_next = self.ts.utc(
                dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + 1
            )
            topocentric_next = difference.at(t_next)
            distance_next = topocentric_next.distance().km

            range_rate = distance_next - distance.km  # km/s

            # Get satellite altitude above Earth's surface
            geocentric = satellite.at(t)
            sat_altitude = geocentric.distance().km - 6371.0  # Earth radius

            positions.append({
                'time': dt,
                'elevation': alt.degrees,
                'azimuth': az.degrees,
                'range': distance.km,
                'rangeRate': range_rate,
                'altitude': sat_altitude
            })

        return positions

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
