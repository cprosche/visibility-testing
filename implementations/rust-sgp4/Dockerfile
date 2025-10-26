FROM rust:1.90-slim as builder

WORKDIR /app

# Copy manifest files
COPY Cargo.toml ./

# Copy source code
COPY src/ ./src/

# Build release binary
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/visibility-calculator /app/visibility-calculator

# Create non-root user
RUN useradd -m -u 1001 testuser && \
    chown -R testuser:testuser /app

USER testuser

ENTRYPOINT ["/app/visibility-calculator"]
CMD []
