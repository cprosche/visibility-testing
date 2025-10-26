# Build stage
FROM gcc:13 AS builder

WORKDIR /app

# Install CMake and Git
RUN apt-get update && \
    apt-get install -y cmake git && \
    rm -rf /var/lib/apt/lists/*

# Copy project files
COPY CMakeLists.txt ./
COPY src/ ./src/

# Build the application
RUN mkdir build && cd build && \
    cmake .. && \
    cmake --build . && \
    cmake --install . --prefix /app/install

# Runtime stage
FROM debian:trixie-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder /app/install/bin/visibility_calculator .

# Create non-root user
RUN useradd -m -u 1001 testuser && \
    chown -R testuser:testuser /app

USER testuser

# Set entrypoint
ENTRYPOINT ["./visibility_calculator"]
CMD []
