#!/usr/bin/env python3
"""
Satellite Visibility Calculator - Pure SGP4 Implementation
Alternative implementation using the sgp4 library directly.
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime
import time

from calculator import VisibilityCalculator


def load_test_case(filepath):
    """Load a test case from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def write_result(result, output_dir):
    """Write result to output directory."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    filename = f"python-sgp4_{result['testCase']}_{timestamp}.json"
    filepath = output_dir / filename

    with open(filepath, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"✓ Wrote results to {filepath}")


def main():
    """Main entry point."""
    # Configuration - prefer Docker paths, fall back to local
    if Path("/test-data/cases").exists():
        test_data_dir = Path("/test-data/cases")
        results_dir = Path("/results")
    else:
        test_data_dir = Path("../../test-data/cases")
        results_dir = Path("../../results")

    # Get test case from command line or run all
    if len(sys.argv) > 1:
        test_case_name = sys.argv[1]
        test_files = [test_data_dir / f"{test_case_name}.json"]
    else:
        test_files = sorted(test_data_dir.glob("*.json"))

    print(f"SGP4 Satellite Visibility Calculator")
    print(f"=" * 50)
    print(f"Test data directory: {test_data_dir}")
    print(f"Results directory: {results_dir}")
    print(f"Found {len(test_files)} test case(s)")
    print()

    # Initialize calculator
    calculator = VisibilityCalculator()

    # Process each test case
    for test_file in test_files:
        if not test_file.exists():
            print(f"✗ Test file not found: {test_file}")
            sys.exit(1)

        print(f"Processing: {test_file.name}")

        try:
            # Load test case
            test_case = load_test_case(test_file)

            # Calculate visibility
            start_time = time.time()
            result = calculator.calculate(test_case)
            execution_time = time.time() - start_time

            # Add metadata
            result['executionTime'] = round(execution_time, 3)
            result['timestamp'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            result['metadata'] = {
                'libraryName': 'sgp4',
                'libraryVersion': calculator.get_version(),
                'platform': f"Python {sys.version.split()[0]}"
            }

            # Write result
            write_result(result, results_dir)

            print(f"  Execution time: {execution_time:.3f}s")
            print(f"  Visibility windows: {len(result['visibilityWindows'])}")
            print()

        except Exception as e:
            print(f"✗ Error processing {test_file.name}: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    print(f"✓ Successfully processed {len(test_files)} test case(s)")
    sys.exit(0)


if __name__ == "__main__":
    main()
