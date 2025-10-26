#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <cmath>
#include <filesystem>
#include <iomanip>
#include <chrono>
#include <nlohmann/json.hpp>

extern "C" {
    #include "norad.h"
    #include "observe.h"
}

using json = nlohmann::json;
namespace fs = std::filesystem;

constexpr double DEG2RAD = M_PI / 180.0;
constexpr double RAD2DEG = 180.0 / M_PI;
constexpr double EARTH_RADIUS_KM = 6371.0;
constexpr double WGS72_EARTH_RADIUS_KM = 6378.135; // WGS-72 Earth radius for SGP4

struct PositionPoint {
    std::string time;
    double azimuth;
    double elevation;
    double range;
    double rangeRate;
    double altitude;
};

struct VisibilityWindow {
    std::string start;
    std::string end;
    double maxElevation;
    std::string maxElevationTime;
    double duration;
    std::vector<PositionPoint> points;
};

// Convert ISO 8601 string to Julian Date
double isoToJulianDate(const std::string& isoStr) {
    int year, month, day, hour, min, sec;
    sscanf(isoStr.c_str(), "%d-%d-%dT%d:%d:%dZ", &year, &month, &day, &hour, &min, &sec);

    if (month <= 2) {
        year -= 1;
        month += 12;
    }

    int a = year / 100;
    int b = 2 - a + a / 4;

    double jd = floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) +
                day + b - 1524.5 + (hour + min / 60.0 + sec / 3600.0) / 24.0;

    return jd;
}

// Convert Julian Date to ISO 8601 string
std::string julianDateToISO(double jd) {
    jd += 0.5;
    int z = (int)jd;
    double f = jd - z;

    int a = z;
    if (z >= 2299161) {
        int alpha = (int)((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - alpha / 4;
    }

    int b = a + 1524;
    int c = (int)((b - 122.1) / 365.25);
    int d = (int)(365.25 * c);
    int e = (int)((b - d) / 30.6001);

    int day = b - d - (int)(30.6001 * e);
    int month = (e < 14) ? (e - 1) : (e - 13);
    int year = (month > 2) ? (c - 4716) : (c - 4715);

    double fractionalDay = f;
    int hour = (int)(fractionalDay * 24.0);
    fractionalDay = (fractionalDay * 24.0 - hour);
    int minute = (int)(fractionalDay * 60.0);
    int second = (int)((fractionalDay * 60.0 - minute) * 60.0);

    char buffer[32];
    snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             year, month, day, hour, minute, second);
    return std::string(buffer);
}

// Calculate GMST
double calcGMST(double jd) {
    double t = (jd - 2451545.0) / 36525.0;
    double gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
                  0.000387933 * t * t - t * t * t / 38710000.0;
    gmst = fmod(gmst, 360.0);
    if (gmst < 0) gmst += 360.0;
    return gmst * DEG2RAD;
}

// Convert ECI to Topocentric Az/El/Range
void eciToTopoAzElRange(double eciX, double eciY, double eciZ, double jd,
                        double obsLat, double obsLon, double obsAlt,
                        double& az, double& el, double& range) {
    double gmst = calcGMST(jd);

    // Observer position in ECEF
    double sinLat = sin(obsLat);
    double cosLat = cos(obsLat);
    double c = 1.0 / sqrt(1.0 - 0.00669437999 * sinLat * sinLat);
    double s = c * (1.0 - 0.00669437999);

    double obsX = (EARTH_RADIUS_KM * c + obsAlt) * cosLat * cos(obsLon);
    double obsY = (EARTH_RADIUS_KM * c + obsAlt) * cosLat * sin(obsLon);
    double obsZ = (EARTH_RADIUS_KM * s + obsAlt) * sinLat;

    // ECI to ECEF (rotate by GMST around Z axis)
    double ecefX = eciX * cos(gmst) + eciY * sin(gmst);
    double ecefY = -eciX * sin(gmst) + eciY * cos(gmst);
    double ecefZ = eciZ;

    // Range vector from observer to satellite in ECEF
    double dx = ecefX - obsX;
    double dy = ecefY - obsY;
    double dz = ecefZ - obsZ;

    // Convert to topocentric SEZ frame
    double south = sinLat * cos(obsLon) * dx + sinLat * sin(obsLon) * dy - cosLat * dz;
    double east = -sin(obsLon) * dx + cos(obsLon) * dy;
    double zenith = cosLat * cos(obsLon) * dx + cosLat * sin(obsLon) * dy + sinLat * dz;

    // Calculate Az, El, Range
    range = sqrt(south * south + east * east + zenith * zenith);
    el = asin(zenith / range) * RAD2DEG;
    az = atan2(east, -south) * RAD2DEG;
    if (az < 0) az += 360.0;
}

std::vector<VisibilityWindow> findVisibilityWindows(const std::vector<PositionPoint>& positions,
                                                      double minElevation) {
    std::vector<VisibilityWindow> windows;
    VisibilityWindow* currentWindow = nullptr;

    for (const auto& pos : positions) {
        if (pos.elevation >= minElevation) {
            if (currentWindow == nullptr) {
                windows.push_back(VisibilityWindow{
                    pos.time, "", pos.elevation, pos.time, 0.0, {}
                });
                currentWindow = &windows.back();
            }

            if (pos.elevation > currentWindow->maxElevation) {
                currentWindow->maxElevation = pos.elevation;
                currentWindow->maxElevationTime = pos.time;
            }

            currentWindow->points.push_back(pos);
        } else if (currentWindow != nullptr) {
            // End of visibility window
            currentWindow->end = currentWindow->points.back().time;
            double startJd = isoToJulianDate(currentWindow->start);
            double endJd = isoToJulianDate(currentWindow->end);
            currentWindow->duration = (endJd - startJd) * 86400.0;
            currentWindow = nullptr;
        }
    }

    // Close final window if still open
    if (currentWindow != nullptr) {
        currentWindow->end = currentWindow->points.back().time;
        double startJd = isoToJulianDate(currentWindow->start);
        double endJd = isoToJulianDate(currentWindow->end);
        currentWindow->duration = (endJd - startJd) * 86400.0;
    }

    return windows;
}

json processTestCase(const json& testCase) {
    // Parse TLE
    tle_t tle;
    std::string line0 = testCase["satellite"]["tle"][0];
    std::string line1 = testCase["satellite"]["tle"][1];
    std::string line2 = testCase["satellite"]["tle"][2];

    parse_elements(line1.c_str(), line2.c_str(), &tle);

    // Observer location in radians
    double obsLat = testCase["observer"]["latitude"].get<double>() * DEG2RAD;
    double obsLon = testCase["observer"]["longitude"].get<double>() * DEG2RAD;
    double obsAlt = testCase["observer"]["altitude"].get<double>() / 1000.0; // m to km

    // Parse time window
    std::string startTimeStr = testCase["timeWindow"]["start"];
    std::string endTimeStr = testCase["timeWindow"]["end"];
    int step = testCase["timeWindow"]["step"];

    double startJd = isoToJulianDate(startTimeStr);
    double endJd = isoToJulianDate(endTimeStr);
    double stepDays = step / 86400.0;

    double minElevation = testCase["minElevation"];

    // Initialize SGP4 parameters
    double params[N_SAT_PARAMS];
    SGP4_init(params, &tle);

    // Calculate positions
    std::vector<PositionPoint> positions;
    double currentJd = startJd;

    while (currentJd <= endJd) {
        double tsince = (currentJd - tle.epoch) * 1440.0; // minutes since epoch

        double pos[3], vel[3];
        SGP4(tsince, &tle, params, pos, vel);

        // Positions are already in kilometers
        double pos_km[3] = { pos[0], pos[1], pos[2] };

        // Convert to Az/El/Range
        double az, el, range;
        eciToTopoAzElRange(pos_km[0], pos_km[1], pos_km[2], currentJd,
                          obsLat, obsLon, obsAlt, az, el, range);

        // Calculate range rate
        double rangeRate = 0.0;
        if (currentJd < endJd) {
            double nextJd = currentJd + 1.0 / 86400.0; // 1 second later
            double nextTsince = (nextJd - tle.epoch) * 1440.0;
            double nextPos[3], nextVel[3];
            SGP4(nextTsince, &tle, params, nextPos, nextVel);

            // Positions are already in kilometers
            double nextPos_km[3] = { nextPos[0], nextPos[1], nextPos[2] };

            double nextAz, nextEl, nextRange;
            eciToTopoAzElRange(nextPos_km[0], nextPos_km[1], nextPos_km[2], nextJd,
                             obsLat, obsLon, obsAlt, nextAz, nextEl, nextRange);
            rangeRate = nextRange - range;
        }

        double satAlt = sqrt(pos_km[0] * pos_km[0] + pos_km[1] * pos_km[1] + pos_km[2] * pos_km[2]) - EARTH_RADIUS_KM;

        positions.push_back(PositionPoint{
            julianDateToISO(currentJd),
            round(az * 100.0) / 100.0,
            round(el * 100.0) / 100.0,
            round(range * 100.0) / 100.0,
            round(rangeRate * 1000.0) / 1000.0,
            round(satAlt * 100.0) / 100.0
        });

        currentJd += stepDays;
    }

    // Find visibility windows
    auto windows = findVisibilityWindows(positions, minElevation);

    // Build result JSON
    json result;
    result["testCase"] = testCase["name"];
    result["implementation"] = "cpp-sgp4";
    result["version"] = "1.0.0";
    result["visibilityWindows"] = json::array();

    for (const auto& window : windows) {
        json windowJson;
        windowJson["start"] = window.start;
        windowJson["end"] = window.end;
        windowJson["maxElevation"] = round(window.maxElevation * 100.0) / 100.0;
        windowJson["maxElevationTime"] = window.maxElevationTime;
        windowJson["duration"] = round(window.duration * 100.0) / 100.0;
        windowJson["points"] = json::array();

        for (const auto& point : window.points) {
            windowJson["points"].push_back({
                {"time", point.time},
                {"azimuth", point.azimuth},
                {"elevation", point.elevation},
                {"range", point.range},
                {"rangeRate", point.rangeRate},
                {"altitude", point.altitude}
            });
        }

        result["visibilityWindows"].push_back(windowJson);
    }

    return result;
}

int main(int argc, char* argv[]) {
    // Configuration
    std::string testDataDir = fs::exists("/test-data/cases") ? "/test-data/cases" : "../../test-data/cases";
    std::string resultsDir = fs::exists("/results") ? "/results" : "../../results";

    std::cout << "C++ SGP4 Satellite Visibility Calculator" << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << "Test data directory: " << testDataDir << std::endl;
    std::cout << "Results directory: " << resultsDir << std::endl;

    // Get test files
    std::vector<std::string> testFiles;
    if (argc > 1) {
        testFiles.push_back(testDataDir + "/" + std::string(argv[1]) + ".json");
    } else {
        for (const auto& entry : fs::directory_iterator(testDataDir)) {
            if (entry.path().extension() == ".json") {
                testFiles.push_back(entry.path().string());
            }
        }
        std::sort(testFiles.begin(), testFiles.end());
    }

    std::cout << "Found " << testFiles.size() << " test case(s)" << std::endl;
    std::cout << std::endl;

    for (const auto& testFile : testFiles) {
        try {
            std::cout << "Processing: " << fs::path(testFile).filename().string() << std::endl;

            std::ifstream file(testFile);
            json testCase = json::parse(file);

            auto startTime = std::chrono::high_resolution_clock::now();
            json result = processTestCase(testCase);
            auto endTime = std::chrono::high_resolution_clock::now();

            double executionTime = std::chrono::duration<double>(endTime - startTime).count();

            result["executionTime"] = executionTime;
            auto now = std::chrono::system_clock::now();
            auto now_t = std::chrono::system_clock::to_time_t(now);
            char timestamp[32];
            strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now_t));
            result["timestamp"] = timestamp;
            result["metadata"] = {
                {"libraryName", "sat_code (Bill Gray)"},
                {"libraryVersion", "2023"},
                {"platform", "C++17"}
            };

            // Write result with timestamp
            fs::create_directories(resultsDir);
            strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", gmtime(&now_t));
            std::string outputFile = resultsDir + "/cpp-sgp4_" +
                                    result["testCase"].get<std::string>() + "_" +
                                    timestamp + ".json";

            std::ofstream outFile(outputFile);
            outFile << result.dump(2) << std::endl;

            std::cout << "✓ Wrote results to " << outputFile << std::endl;
            std::cout << "  Execution time: " << std::fixed << std::setprecision(3)
                     << executionTime << "s" << std::endl;
            std::cout << "  Visibility windows: " << result["visibilityWindows"].size() << std::endl;
            std::cout << std::endl;

        } catch (const std::exception& e) {
            std::cerr << "✗ Error processing " << fs::path(testFile).filename().string()
                     << ": " << e.what() << std::endl;
            return 1;
        }
    }

    std::cout << "✓ Successfully processed " << testFiles.size() << " test case(s)" << std::endl;
    return 0;
}
