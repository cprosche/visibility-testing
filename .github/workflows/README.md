# GitHub Actions Workflows

This directory contains CI/CD workflows for the Satellite Visibility Testing Framework.

## Workflows

### 1. Test Suite (`test.yml`)

**Triggers:**
- Push to `master` or `develop` branches
- Pull requests to `master`
- Manual workflow dispatch

**What it does:**
1. Discovers all implementations by scanning for Dockerfiles
2. Builds Docker images for each implementation (parallel)
3. Runs test suite through the Rust orchestrator
4. Validates results against reference data (requires 10/10 pass)
5. Uploads test results as artifacts (30-day retention)

**Artifacts:**
- `test-results-{implementation}`: Test logs and JSON results

**Failure conditions:**
- Docker build fails
- Any test case fails
- Validation shows < 10/10 matches

### 2. Performance Benchmark (`benchmark.yml`)

**Triggers:**
- Push to `master` branch
- Weekly schedule (Sundays at 00:00 UTC)
- Manual workflow dispatch

**What it does:**
1. Builds all implementations
2. Runs complete test suite
3. Measures execution times
4. Generates performance report (markdown)
5. Checks for regressions

**Performance thresholds:**
- General: < 60 seconds per implementation
- Python-skyfield: < 40 seconds (high-precision calculations expected)

**Artifacts:**
- `benchmark-results`: Performance reports (90-day retention)

### 3. Docker Build (`docker-build.yml`)

**Triggers:**
- Push to `master` with changes in `implementations/` or `test-runner/`
- Manual workflow dispatch

**What it does:**
1. Detects which implementations changed
2. Builds only modified Docker images
3. Tests each image with a sample test case
4. Uses GitHub Actions cache for layers

**Cache strategy:**
- Docker layers cached per implementation
- Cache key includes file hashes
- Fallback to previous builds

## Local Testing

### Reproduce CI builds locally:

```bash
# Run all tests (like CI does)
cd test-runner
cargo run --release -- run

# Validate results
cargo run --release -- validate

# Build specific implementation
cd implementations/rust-sgp4
docker build -t visibility-test/rust-sgp4:latest .

# Run specific test
docker run --rm \
  -v $(pwd)/../../test-data:/test-data:ro \
  -v $(pwd)/../../results:/results \
  visibility-test/rust-sgp4:latest \
  001_iss_nyc
```

### Run with docker-compose:

```bash
# Build all images
docker-compose build

# Run all implementations
docker-compose up

# Run specific implementation
docker-compose up python-sgp4
```

## Troubleshooting

### Build failures

**Problem:** Docker build fails with "out of space"
**Solution:** Clean Docker cache
```bash
docker system prune -a
```

**Problem:** "Cache mount not found"
**Solution:** Ensure Docker BuildKit is enabled
```bash
export DOCKER_BUILDKIT=1
```

### Test failures

**Problem:** Tests pass locally but fail in CI
**Solution:** Check for timing issues or file path assumptions

**Problem:** Validation fails (< 10/10)
**Solution:**
1. Check implementation logs in artifacts
2. Compare with reference results
3. Verify coordinate transformations

### Performance regressions

**Problem:** Benchmark workflow fails with regression
**Solution:**
1. Check which implementation is slow
2. Review recent code changes
3. Profile the implementation locally
4. Verify not downloading data files on each run

## Adding New Implementations

When adding a new implementation:

1. **Create directory structure:**
   ```
   implementations/new-lang-library/
   ├── Dockerfile
   ├── src/
   └── ...
   ```

2. **Dockerfile requirements:**
   - Must accept test-data at `/test-data` (read-only)
   - Must write results to `/results`
   - Should accept optional test case name as argument

3. **CI auto-discovery:**
   - The `discover` job automatically finds new implementations
   - No workflow changes needed
   - Must have a Dockerfile in the root of implementation directory

4. **Test locally first:**
   ```bash
   cd test-runner
   cargo run --release -- build -i new-lang-library
   cargo run --release -- run -i new-lang-library
   cargo run --release -- validate -i new-lang-library
   ```

## Badge URLs

Update README.md with your repository URL:

```markdown
[![Test Suite](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/test.yml/badge.svg)](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/test.yml)
[![Performance Benchmark](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/benchmark.yml/badge.svg)](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/benchmark.yml)
[![Docker Build](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/docker-build.yml/badge.svg)](https://github.com/YOUR_USERNAME/visibility-testing/actions/workflows/docker-build.yml)
```

## Maintenance

### Updating dependencies

The workflows use:
- `actions/checkout@v4`
- `actions/cache@v3`
- `actions/upload-artifact@v3`
- `docker/setup-buildx-action@v3`
- `docker/build-push-action@v5`
- `actions-rust-lang/setup-rust-toolchain@v1`

Check for updates periodically via Dependabot or manually.

### Adjusting retention periods

Edit workflow files:
- Test artifacts: `retention-days: 30` (in test.yml)
- Benchmark results: `retention-days: 90` (in benchmark.yml)

### Modifying performance thresholds

Edit `benchmark.yml` regression checks:
```yaml
# Increase general threshold
if grep -E "✓.*-.*[6-9][0-9]\.[0-9]+s"  # Current: 60s

# Adjust Skyfield threshold
if grep "python-skyfield.*[4-9][0-9]\.[0-9]+s"  # Current: 40s
```

## CI/CD Best Practices

1. **Always test locally before pushing**
2. **Use feature branches for experimental changes**
3. **Monitor CI run times** (should complete < 5 minutes)
4. **Review artifacts** when builds fail
5. **Keep Docker images lean** (use multi-stage builds)
6. **Cache aggressively** but invalidate when needed
7. **Fail fast** on validation errors
8. **Document performance changes** that affect benchmarks
