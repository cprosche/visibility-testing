#!/usr/bin/env bash

# Script to update dashboard with latest test results
# Run this after executing tests locally to preview the dashboard

set -e

echo "Updating dashboard with latest test results..."

# Create directories if they don't exist
mkdir -p docs/results
mkdir -p docs/reference

# Copy latest results
echo "Copying test results..."
result_count=0

# Check if results are in subdirectories or flat structure
if ls results/*/ &>/dev/null; then
    # Subdirectory structure
    for impl_dir in results/*/; do
        if [ -d "$impl_dir" ]; then
            impl_name=$(basename "$impl_dir")
            # Get the most recent result file for each test case
            for test_file in "$impl_dir"/*.json; do
                if [ -f "$test_file" ]; then
                    cp "$test_file" docs/results/
                    ((result_count++))
                fi
            done
        fi
    done
else
    # Flat structure - copy most recent result for each impl+testcase combo
    # Find unique impl_testcase patterns and get the latest file for each
    for test_file in results/*.json; do
        if [ -f "$test_file" ]; then
            filename=$(basename "$test_file")
            # Extract impl_testcase (everything before the timestamp)
            pattern=$(echo "$filename" | sed -E 's/_[0-9]{8}_[0-9]{6}\.json$//')

            # Find the most recent file matching this pattern
            latest=$(ls -t results/${pattern}_*.json 2>/dev/null | head -1)

            # Only copy if this is the latest file for this pattern
            if [ "$test_file" = "$latest" ]; then
                cp "$test_file" docs/results/
                ((result_count++))
            fi
        fi
    done
fi

# Copy reference results
echo "Copying reference results..."
ref_count=0
if [ -d "test-data/reference-results" ]; then
    for ref_file in test-data/reference-results/*.json; do
        if [ -f "$ref_file" ]; then
            cp "$ref_file" docs/reference/
            ((ref_count++))
        fi
    done
fi

# Generate results manifest
echo "Generating results manifest..."
cat > docs/results-manifest.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "local-development",
  "results": [
EOF

# Add all result files
first=true
for file in docs/results/*.json; do
    if [ -f "$file" ]; then
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> docs/results-manifest.json
        fi
        echo "    \"$(basename "$file")\"" >> docs/results-manifest.json
    fi
done

cat >> docs/results-manifest.json << EOF

  ]
}
EOF

# Generate reference manifest
echo "Generating reference manifest..."
cat > docs/reference-manifest.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "results": [
EOF

# Add all reference files
first=true
for file in docs/reference/*.json; do
    if [ -f "$file" ]; then
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> docs/reference-manifest.json
        fi
        echo "    \"$(basename "$file")\"" >> docs/reference-manifest.json
    fi
done

cat >> docs/reference-manifest.json << EOF

  ]
}
EOF

echo ""
echo "✓ Dashboard updated successfully!"
echo "  Results: $result_count files"
echo "  Reference: $ref_count files"
echo ""
echo "To view the dashboard locally:"
echo "  cd docs && python3 -m http.server 8000"
echo "  Then open: http://localhost:8000"
