using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Zeptomoby.OrbitTools;

namespace VisibilityCalculator
{
    class Program
    {
        const double DEG2RAD = Math.PI / 180.0;
        const double RAD2DEG = 180.0 / Math.PI;
        const double EARTH_RADIUS_KM = 6371.0;

        static void Main(string[] args)
        {
            // Configuration - prefer Docker paths, fall back to local
            string testDataDir = Directory.Exists("/test-data/cases")
                ? "/test-data/cases"
                : "../../test-data/cases";
            string resultsDir = Directory.Exists("/results")
                ? "/results"
                : "../../results";

            Console.WriteLine("C# SGP4 Satellite Visibility Calculator");
            Console.WriteLine("==================================================");
            Console.WriteLine($"Test data directory: {testDataDir}");
            Console.WriteLine($"Results directory: {resultsDir}");

            // Get test files
            List<string> testFiles;
            if (args.Length > 0)
            {
                testFiles = new List<string> { Path.Combine(testDataDir, $"{args[0]}.json") };
            }
            else
            {
                testFiles = Directory.GetFiles(testDataDir, "*.json").OrderBy(f => f).ToList();
            }

            Console.WriteLine($"Found {testFiles.Count} test case(s)");
            Console.WriteLine();

            foreach (var testFile in testFiles)
            {
                try
                {
                    Console.WriteLine($"Processing: {Path.GetFileName(testFile)}");

                    var testCase = JsonConvert.DeserializeObject<TestCase>(File.ReadAllText(testFile));
                    if (testCase == null) throw new Exception("Failed to parse test case");

                    var startTime = DateTime.UtcNow;
                    var result = Calculate(testCase);
                    var executionTime = (DateTime.UtcNow - startTime).TotalSeconds;

                    result.ExecutionTime = executionTime;
                    result.Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
                    result.Metadata = new Metadata
                    {
                        LibraryName = "Zeptomoby.OrbitTools.Core",
                        LibraryVersion = "2.0.0",
                        Platform = $".NET {Environment.Version}"
                    };

                    // Write result with timestamp
                    Directory.CreateDirectory(resultsDir);
                    var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                    var outputFile = Path.Combine(resultsDir, $"csharp-sgp.net_{result.TestCase}_{timestamp}.json");
                    File.WriteAllText(outputFile, JsonConvert.SerializeObject(result, Formatting.Indented));

                    Console.WriteLine($"✓ Wrote results to {outputFile}");
                    Console.WriteLine($"  Execution time: {executionTime:F3}s");
                    Console.WriteLine($"  Visibility windows: {result.VisibilityWindows.Count}");
                    Console.WriteLine();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"✗ Error processing {Path.GetFileName(testFile)}: {ex.Message}");
                    Console.WriteLine(ex.StackTrace);
                    Environment.Exit(1);
                }
            }

            Console.WriteLine($"✓ Successfully processed {testFiles.Count} test case(s)");
        }

        static Result Calculate(TestCase testCase)
        {
            // Parse TLE
            var tle = new Tle(
                testCase.Satellite.Tle[0],
                testCase.Satellite.Tle[1],
                testCase.Satellite.Tle[2]
            );

            // Create orbit object
            var orbit = new Orbit(tle);

            // Observer location in radians
            double obsLat = testCase.Observer.Latitude * DEG2RAD;
            double obsLon = testCase.Observer.Longitude * DEG2RAD;
            double obsAlt = testCase.Observer.Altitude / 1000.0; // m to km

            // Parse time window
            var startTime = DateTime.Parse(testCase.TimeWindow.Start).ToUniversalTime();
            var endTime = DateTime.Parse(testCase.TimeWindow.End).ToUniversalTime();
            var step = TimeSpan.FromSeconds(testCase.TimeWindow.Step);

            var positions = new List<PositionPoint>();
            var currentTime = startTime;

            while (currentTime <= endTime)
            {
                // Get satellite position in ECI coordinates
                var eci = orbit.PositionEci(currentTime);

                // Convert ECI to topocentric coordinates
                var (az, el, range) = EciToTopoAzElRange(
                    eci.Position.X, eci.Position.Y, eci.Position.Z,
                    currentTime, obsLat, obsLon, obsAlt);

                // Calculate range rate
                double rangeRate = 0.0;
                if (currentTime < endTime)
                {
                    var nextTime = currentTime.Add(TimeSpan.FromSeconds(1));
                    var nextEci = orbit.PositionEci(nextTime);
                    var (_, __, nextRange) = EciToTopoAzElRange(
                        nextEci.Position.X, nextEci.Position.Y, nextEci.Position.Z,
                        nextTime, obsLat, obsLon, obsAlt);
                    rangeRate = nextRange - range; // km/s
                }

                var satAlt = Math.Sqrt(eci.Position.X * eci.Position.X +
                                      eci.Position.Y * eci.Position.Y +
                                      eci.Position.Z * eci.Position.Z) - EARTH_RADIUS_KM;

                positions.Add(new PositionPoint
                {
                    Time = currentTime.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    Azimuth = Math.Round(az, 2),
                    Elevation = Math.Round(el, 2),
                    Range = Math.Round(range, 2),
                    RangeRate = Math.Round(rangeRate, 3),
                    Altitude = Math.Round(satAlt, 2)
                });

                currentTime = currentTime.Add(step);
            }

            // Find visibility windows
            var windows = FindVisibilityWindows(positions, testCase.MinElevation);

            return new Result
            {
                TestCase = testCase.Name,
                Implementation = "csharp-sgp.net",
                Version = "1.0.0",
                VisibilityWindows = windows
            };
        }

        static (double az, double el, double range) EciToTopoAzElRange(
            double eciX, double eciY, double eciZ,
            DateTime time, double obsLat, double obsLon, double obsAlt)
        {
            // Calculate GMST
            var jd = ToJulianDate(time);
            var tu = (jd - 2451545.0) / 36525.0;
            var gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * tu * tu - tu * tu * tu / 38710000.0;
            gmst = (gmst % 360.0) * DEG2RAD;

            // Observer position in ECEF
            double sinLat = Math.Sin(obsLat);
            double cosLat = Math.Cos(obsLat);
            double c = 1.0 / Math.Sqrt(1.0 - 0.00669437999 * sinLat * sinLat);
            double s = c * (1.0 - 0.00669437999);

            double obsX = (EARTH_RADIUS_KM * c + obsAlt) * cosLat * Math.Cos(obsLon);
            double obsY = (EARTH_RADIUS_KM * c + obsAlt) * cosLat * Math.Sin(obsLon);
            double obsZ = (EARTH_RADIUS_KM * s + obsAlt) * sinLat;

            // ECI to ECEF (rotate by GMST around Z axis)
            double ecefX = eciX * Math.Cos(gmst) + eciY * Math.Sin(gmst);
            double ecefY = -eciX * Math.Sin(gmst) + eciY * Math.Cos(gmst);
            double ecefZ = eciZ;

            // Range vector from observer to satellite in ECEF
            double dx = ecefX - obsX;
            double dy = ecefY - obsY;
            double dz = ecefZ - obsZ;

            // Convert to topocentric SEZ frame
            double south = Math.Sin(obsLat) * Math.Cos(obsLon) * dx + Math.Sin(obsLat) * Math.Sin(obsLon) * dy - Math.Cos(obsLat) * dz;
            double east = -Math.Sin(obsLon) * dx + Math.Cos(obsLon) * dy;
            double zenith = Math.Cos(obsLat) * Math.Cos(obsLon) * dx + Math.Cos(obsLat) * Math.Sin(obsLon) * dy + Math.Sin(obsLat) * dz;

            // Calculate Az, El, Range
            double range = Math.Sqrt(south * south + east * east + zenith * zenith);
            double el = Math.Asin(zenith / range) * RAD2DEG;
            double az = Math.Atan2(east, -south) * RAD2DEG;
            if (az < 0) az += 360.0;

            return (az, el, range);
        }

        static double ToJulianDate(DateTime date)
        {
            int year = date.Year;
            int month = date.Month;
            double day = date.Day + date.Hour / 24.0 + date.Minute / 1440.0 + date.Second / 86400.0;

            if (month <= 2)
            {
                year -= 1;
                month += 12;
            }

            int a = year / 100;
            int b = 2 - a + a / 4;

            return Math.Floor(365.25 * (year + 4716)) + Math.Floor(30.6001 * (month + 1)) + day + b - 1524.5;
        }

        static List<VisibilityWindow> FindVisibilityWindows(List<PositionPoint> positions, double minElevation)
        {
            var windows = new List<VisibilityWindow>();
            VisibilityWindow? currentWindow = null;

            foreach (var pos in positions)
            {
                if (pos.Elevation >= minElevation)
                {
                    if (currentWindow == null)
                    {
                        currentWindow = new VisibilityWindow
                        {
                            Start = pos.Time,
                            MaxElevation = pos.Elevation,
                            MaxElevationTime = pos.Time,
                            Points = new List<PositionPoint>()
                        };
                    }

                    if (pos.Elevation > currentWindow.MaxElevation)
                    {
                        currentWindow.MaxElevation = pos.Elevation;
                        currentWindow.MaxElevationTime = pos.Time;
                    }

                    currentWindow.Points.Add(pos);
                }
                else if (currentWindow != null)
                {
                    // End of visibility window
                    currentWindow.End = currentWindow.Points.Last().Time;
                    var start = DateTime.Parse(currentWindow.Start);
                    var end = DateTime.Parse(currentWindow.End);
                    currentWindow.Duration = (end - start).TotalSeconds;

                    windows.Add(currentWindow);
                    currentWindow = null;
                }
            }

            // Close final window if still open
            if (currentWindow != null)
            {
                currentWindow.End = currentWindow.Points.Last().Time;
                var start = DateTime.Parse(currentWindow.Start);
                var end = DateTime.Parse(currentWindow.End);
                currentWindow.Duration = (end - start).TotalSeconds;
                windows.Add(currentWindow);
            }

            return windows;
        }
    }

    // Data models
    class TestCase
    {
        [JsonProperty("name")]
        public string Name { get; set; } = "";

        [JsonProperty("satellite")]
        public SatelliteInfo Satellite { get; set; } = new();

        [JsonProperty("observer")]
        public ObserverInfo Observer { get; set; } = new();

        [JsonProperty("timeWindow")]
        public TimeWindowInfo TimeWindow { get; set; } = new();

        [JsonProperty("minElevation")]
        public double MinElevation { get; set; }
    }

    class SatelliteInfo
    {
        [JsonProperty("tle")]
        public List<string> Tle { get; set; } = new();
    }

    class ObserverInfo
    {
        [JsonProperty("latitude")]
        public double Latitude { get; set; }

        [JsonProperty("longitude")]
        public double Longitude { get; set; }

        [JsonProperty("altitude")]
        public double Altitude { get; set; }
    }

    class TimeWindowInfo
    {
        [JsonProperty("start")]
        public string Start { get; set; } = "";

        [JsonProperty("end")]
        public string End { get; set; } = "";

        [JsonProperty("step")]
        public int Step { get; set; }
    }

    class Result
    {
        [JsonProperty("testCase")]
        public string TestCase { get; set; } = "";

        [JsonProperty("implementation")]
        public string Implementation { get; set; } = "";

        [JsonProperty("version")]
        public string Version { get; set; } = "";

        [JsonProperty("visibilityWindows")]
        public List<VisibilityWindow> VisibilityWindows { get; set; } = new();

        [JsonProperty("executionTime")]
        public double ExecutionTime { get; set; }

        [JsonProperty("timestamp")]
        public string Timestamp { get; set; } = "";

        [JsonProperty("metadata")]
        public Metadata Metadata { get; set; } = new();
    }

    class VisibilityWindow
    {
        [JsonProperty("start")]
        public string Start { get; set; } = "";

        [JsonProperty("end")]
        public string End { get; set; } = "";

        [JsonProperty("maxElevation")]
        public double MaxElevation { get; set; }

        [JsonProperty("maxElevationTime")]
        public string MaxElevationTime { get; set; } = "";

        [JsonProperty("duration")]
        public double Duration { get; set; }

        [JsonProperty("points")]
        public List<PositionPoint> Points { get; set; } = new();
    }

    class PositionPoint
    {
        [JsonProperty("time")]
        public string Time { get; set; } = "";

        [JsonProperty("azimuth")]
        public double Azimuth { get; set; }

        [JsonProperty("elevation")]
        public double Elevation { get; set; }

        [JsonProperty("range")]
        public double Range { get; set; }

        [JsonProperty("rangeRate")]
        public double RangeRate { get; set; }

        [JsonProperty("altitude")]
        public double Altitude { get; set; }
    }

    class Metadata
    {
        [JsonProperty("libraryName")]
        public string LibraryName { get; set; } = "";

        [JsonProperty("libraryVersion")]
        public string LibraryVersion { get; set; } = "";

        [JsonProperty("platform")]
        public string Platform { get; set; } = "";
    }
}
