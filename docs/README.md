# Test Results Dashboard

This directory contains the GitHub Pages site that visualizes test results from the Satellite Visibility Testing Framework.

## Overview

The dashboard provides:
- **Performance rankings** - Compare execution times across implementations
- **Accuracy histograms** - Visualize precision deltas vs reference implementation
- **Test case breakdown** - Per-test performance analysis
- **Implementation details** - Detailed stats for each language/library

## Architecture

```
docs/
├── index.html              # Main dashboard page
├── styles.css              # Dark theme styling
├── dashboard.js            # Data loading and visualization logic
├── results/                # Latest test results (JSON)
├── reference/              # Reference implementation results (JSON)
├── results-manifest.json   # Index of available results
├── reference-manifest.json # Index of reference results
├── update-dashboard.sh     # Script to refresh local data
└── README.md              # This file
```

## Local Development

### View the dashboard locally

1. **Run tests to generate results:**
   ```bash
   cd test-runner
   cargo run --release -- run
   ```

2. **Update dashboard data:**
   ```bash
   ./docs/update-dashboard.sh
   ```

3. **Start local server:**
   ```bash
   cd docs
   python3 -m http.server 8000
   ```

4. **Open in browser:**
   ```
   http://localhost:8000
   ```

### Making changes

**HTML/CSS/JavaScript changes:**
- Edit `index.html`, `styles.css`, or `dashboard.js`
- Refresh browser to see changes
- No build step required - static site

**Data format changes:**
- Modify JSON structure in test implementations
- Update `dashboard.js` parsing logic
- Test with `update-dashboard.sh`

## Deployment

The dashboard is automatically deployed to GitHub Pages via the `.github/workflows/pages.yml` workflow:

1. **Triggered by:**
   - Push to `main` branch
   - Manual workflow dispatch
   - Daily schedule (00:00 UTC)

2. **Build process:**
   - Runs all test implementations
   - Copies results to `docs/results/`
   - Copies reference data to `docs/reference/`
   - Generates manifest files
   - Deploys to GitHub Pages

3. **URL:**
   - `https://{username}.github.io/visibility-testing/`
   - Or custom domain if configured

## Data Files

### results-manifest.json
Lists all available test result files:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "commit": "abc123...",
  "results": [
    "python-skyfield_001_iss_nyc.json",
    "rust-sgp4_001_iss_nyc.json",
    ...
  ]
}
```

### reference-manifest.json
Lists reference implementation results:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "results": [
    "python-skyfield_001_iss_nyc.json",
    ...
  ]
}
```

### Result JSON format
Each result file follows the standard format:
```json
{
  "testCase": "001_iss_nyc",
  "implementation": "rust-sgp4",
  "version": "1.0.0",
  "executionTime": 0.026,
  "visibilityWindows": [
    {
      "start": "2024-01-01T06:23:15Z",
      "end": "2024-01-01T06:30:42Z",
      "maxElevation": 68.5,
      "points": [...]
    }
  ]
}
```

## Visualizations

### Performance Chart
- **Type:** Horizontal bar chart
- **Data:** Average execution time per implementation
- **Colors:** Language-specific (Python=blue, Rust=orange, etc.)
- **Library:** Chart.js

### Test Case Breakdown
- **Type:** Grouped bar chart
- **Data:** Execution time per test case per implementation
- **Purpose:** Identify test cases that are slow or problematic

### Accuracy Histograms
- **Type:** Histogram (3 separate charts)
- **Metrics:** Azimuth, Elevation, Range error distributions
- **Data:** Absolute difference from reference implementation
- **Purpose:** Visualize precision and identify outliers

### Rankings Table
- **Type:** Sortable table
- **Metrics:** Rank, implementation, language, avg time, relative speed, success rate
- **Features:** Medal badges for top 3, speed bars

## Customization

### Theme colors
Edit `styles.css` to change the color scheme:
```css
:root {
    --bg-primary: #0d1117;      /* Main background */
    --bg-secondary: #161b22;    /* Card backgrounds */
    --accent-blue: #58a6ff;     /* Primary accent */
    /* ... */
}
```

### Chart options
Edit `dashboard.js` to customize Chart.js options:
```javascript
const CHART_COLORS = {
    blue: 'rgb(88, 166, 255)',
    green: 'rgb(63, 185, 80)',
    // ...
};
```

### Language badges
Add new languages in `styles.css`:
```css
.lang-go {
    background: #00add833;
    color: #00add8;
    border: 1px solid #00add8;
}
```

## Troubleshooting

### Dashboard shows "Failed to load results"
- Check that `results-manifest.json` exists
- Verify JSON files are in `docs/results/`
- Run `update-dashboard.sh` to regenerate manifests
- Check browser console for errors

### Charts not rendering
- Verify Chart.js CDN is accessible
- Check for JavaScript errors in console
- Ensure data format matches expected structure

### Data not updating after push
- Check GitHub Actions workflow status
- Verify Pages deployment succeeded
- May take 1-2 minutes for CDN to update
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Local server CORS errors
- Use `python3 -m http.server` instead of `file://`
- Or use `npx serve docs` for a proper HTTP server

## Future Enhancements

Potential additions:
- [ ] Time-series graphs showing performance trends
- [ ] Interactive satellite ground track maps
- [ ] Downloadable CSV/JSON data exports
- [ ] Comparison mode (select 2+ implementations)
- [ ] Dark/light theme toggle
- [ ] Search and filter capabilities
- [ ] Per-test-case detailed view with sky charts
- [ ] Mobile-responsive design improvements
- [ ] WebGL satellite orbit visualizations

## Resources

- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions for Pages](https://github.com/actions/deploy-pages)
