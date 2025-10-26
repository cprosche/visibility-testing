cmake_minimum_required(VERSION 3.15)
project(VisibilityCalculator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include FetchContent for downloading dependencies
include(FetchContent)

# Fetch nlohmann/json
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(json)

# Fetch Bill Gray's sat_code
FetchContent_Declare(
    sat_code
    GIT_REPOSITORY https://github.com/Bill-Gray/sat_code.git
    GIT_TAG master
)
FetchContent_GetProperties(sat_code)
if(NOT sat_code_POPULATED)
    FetchContent_Populate(sat_code)
endif()

# Build sat_code as a static library
set(SAT_CODE_DIR ${sat_code_SOURCE_DIR})
add_library(sat_code STATIC
    ${SAT_CODE_DIR}/sgp.cpp
    ${SAT_CODE_DIR}/sgp4.cpp
    ${SAT_CODE_DIR}/sgp8.cpp
    ${SAT_CODE_DIR}/sdp4.cpp
    ${SAT_CODE_DIR}/sdp8.cpp
    ${SAT_CODE_DIR}/deep.cpp
    ${SAT_CODE_DIR}/basics.cpp
    ${SAT_CODE_DIR}/get_el.cpp
    ${SAT_CODE_DIR}/common.cpp
)

target_include_directories(sat_code PUBLIC ${SAT_CODE_DIR})

# Build main executable
add_executable(visibility_calculator src/main.cpp)

target_link_libraries(visibility_calculator
    PRIVATE
    nlohmann_json::nlohmann_json
    sat_code
    m
)

target_include_directories(visibility_calculator
    PRIVATE
    ${SAT_CODE_DIR}
)

# Install target
install(TARGETS visibility_calculator DESTINATION bin)
