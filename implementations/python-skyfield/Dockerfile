FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Create non-root user for security
RUN useradd -m -u 1000 testuser && \
    chown -R testuser:testuser /app

USER testuser

# Set entrypoint
ENTRYPOINT ["python", "src/main.py"]
CMD []
