# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy project file and restore dependencies
COPY VisibilityCalculator.csproj ./
RUN dotnet restore

# Copy source code
COPY src/ ./src/

# Build the application
RUN dotnet publish -c Release -o out

# Runtime stage
FROM mcr.microsoft.com/dotnet/runtime:8.0

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/out .

# Create non-root user
RUN useradd -m -u 1001 testuser && \
    chown -R testuser:testuser /app

USER testuser

# Set entrypoint
ENTRYPOINT ["dotnet", "VisibilityCalculator.dll"]
CMD []
