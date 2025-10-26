use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
use walkdir::WalkDir;

#[derive(Parser)]
#[command(name = "visibility-test-runner")]
#[command(about = "Docker-based test orchestrator for satellite visibility implementations")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Discover all implementations
    Discover,

    /// Build Docker images for implementations
    Build {
        /// Specific implementation to build (optional)
        #[arg(short, long)]
        implementation: Option<String>,
    },

    /// Run tests for implementations
    Run {
        /// Specific implementation to run (optional)
        #[arg(short, long)]
        implementation: Option<String>,

        /// Specific test case to run (optional)
        #[arg(short, long)]
        test_case: Option<String>,

        /// Build images before running
        #[arg(short, long)]
        build: bool,
    },

    /// Validate results against reference
    Validate {
        /// Implementation to validate
        #[arg(short, long)]
        implementation: Option<String>,
    },

    /// Run complete test suite (build + run + validate)
    All {
        /// Specific test case to run (optional)
        #[arg(short, long)]
        test_case: Option<String>,
    },
}

#[derive(Debug, Clone)]
struct Implementation {
    name: String,
    path: PathBuf,
    image_name: String,
}

#[derive(Debug, Serialize)]
struct TestResult {
    implementation: String,
    success: bool,
    execution_time: f64,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct VisibilityResult {
    #[serde(rename = "testCase")]
    test_case: String,
    implementation: String,
    version: String,
    #[serde(rename = "visibilityWindows")]
    visibility_windows: Vec<serde_json::Value>,
    #[serde(rename = "executionTime")]
    execution_time: Option<f64>,
}

struct Orchestrator {
    implementations_dir: PathBuf,
    test_data_dir: PathBuf,
    results_dir: PathBuf,
}

impl Orchestrator {
    fn new() -> Result<Self> {
        let project_root = std::env::current_dir()
            .context("Failed to get current directory")?
            .parent()
            .context("Failed to get project root")?
            .to_path_buf();

        let implementations_dir = project_root.join("implementations");
        let test_data_dir = project_root.join("test-data");
        let results_dir = project_root.join("results");

        fs::create_dir_all(&results_dir)?;

        Ok(Self {
            implementations_dir,
            test_data_dir,
            results_dir,
        })
    }

    fn discover_implementations(&self) -> Result<Vec<Implementation>> {
        let mut implementations = Vec::new();

        if !self.implementations_dir.exists() {
            return Ok(implementations);
        }

        for entry in WalkDir::new(&self.implementations_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_name() == "Dockerfile" {
                if let Some(parent) = entry.path().parent() {
                    if let Some(name) = parent.file_name() {
                        let impl_name = name.to_string_lossy().to_string();
                        let image_name = format!("visibility-test/{}:latest", impl_name);

                        implementations.push(Implementation {
                            name: impl_name,
                            path: parent.to_path_buf(),
                            image_name,
                        });
                    }
                }
            }
        }

        implementations.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(implementations)
    }

    fn build_image(&self, impl_: &Implementation) -> Result<()> {
        println!("Building {}...", impl_.name.bright_cyan());

        let output = Command::new("docker")
            .args(["build", "-t", &impl_.image_name, "."])
            .current_dir(&impl_.path)
            .output()
            .context("Failed to execute docker build")?;

        if !output.status.success() {
            anyhow::bail!(
                "Build failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        println!("  {} Built {}", "✓".green(), impl_.image_name.bright_white());
        Ok(())
    }

    fn run_tests(&self, impl_: &Implementation, test_case: Option<&str>) -> Result<TestResult> {
        println!("Running tests for {}...", impl_.name.bright_cyan());

        let start = Instant::now();

        let mut cmd = Command::new("docker");
        cmd.args([
            "run",
            "--rm",
            "-v",
            &format!("{}:/test-data:ro", self.test_data_dir.display()),
            "-v",
            &format!("{}:/results", self.results_dir.display()),
            &impl_.image_name,
        ]);

        if let Some(tc) = test_case {
            cmd.arg(tc);
        }

        let output = cmd.output().context("Failed to execute docker run")?;

        let execution_time = start.elapsed().as_secs_f64();
        let success = output.status.success();

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if success {
            println!("  {} Tests completed in {}", "✓".green(), format!("{:.2}s", execution_time).bright_white());
        } else {
            println!("  {} Tests failed", "✗".red());
        }

        Ok(TestResult {
            implementation: impl_.name.clone(),
            success,
            execution_time,
            stdout,
            stderr,
        })
    }

    fn collect_results(&self, impl_: &Implementation) -> Result<Vec<PathBuf>> {
        use std::collections::HashMap;

        let pattern = format!("{}_", impl_.name);
        let mut results_by_test_case: HashMap<String, PathBuf> = HashMap::new();

        if !self.results_dir.exists() {
            return Ok(Vec::new());
        }

        for entry in fs::read_dir(&self.results_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with(&pattern) && name_str.ends_with(".json") {
                        // Parse filename formats:
                        // Old: {impl}_{testcase}.json
                        // New: {impl}_{testcase}_{timestamp}.json
                        if let Some(rest) = name_str.strip_prefix(&pattern) {
                            let rest = rest.strip_suffix(".json").unwrap();

                            // Try to parse as new format (with timestamp)
                            // Timestamp format: YYYYMMDD_HHMMSS
                            let test_case = if rest.contains('_') {
                                // Check if last part looks like a timestamp
                                let parts: Vec<&str> = rest.split('_').collect();
                                if parts.len() >= 2 {
                                    let last_part = parts[parts.len() - 1];
                                    let second_last = parts[parts.len() - 2];
                                    // If last two parts look like timestamp (YYYYMMDD_HHMMSS)
                                    if last_part.len() == 6 && second_last.len() == 8
                                       && last_part.chars().all(|c| c.is_numeric())
                                       && second_last.chars().all(|c| c.is_numeric()) {
                                        // New format with timestamp - extract test case
                                        parts[..parts.len() - 2].join("_")
                                    } else {
                                        // Old format without timestamp
                                        rest.to_string()
                                    }
                                } else {
                                    rest.to_string()
                                }
                            } else {
                                rest.to_string()
                            };

                            // Keep only the most recent result for each test case
                            results_by_test_case
                                .entry(test_case.clone())
                                .and_modify(|existing| {
                                    // Keep the newer file (lexicographically later)
                                    if name_str > existing.file_name().unwrap().to_string_lossy() {
                                        *existing = path.clone();
                                    }
                                })
                                .or_insert_with(|| path.clone());
                        }
                    }
                }
            }
        }

        let mut results: Vec<PathBuf> = results_by_test_case.into_values().collect();
        results.sort();
        Ok(results)
    }

    fn validate_results(&self, impl_name: &str) -> Result<()> {
        println!("Validating results for {}...", impl_name.bright_cyan());

        let reference_dir = self.test_data_dir.join("reference-results");
        let results = self.collect_results(&Implementation {
            name: impl_name.to_string(),
            path: PathBuf::new(),
            image_name: String::new(),
        })?;

        if results.is_empty() {
            println!("  {} No results found for {}", "⚠".yellow(), impl_name);
            return Ok(());
        }

        let mut match_count = 0;
        let total_count = results.len();

        for result_file in &results {
            let result_data: VisibilityResult =
                serde_json::from_str(&fs::read_to_string(result_file)?)?;

            // Find corresponding reference file
            let ref_file_name = format!(
                "python-skyfield_{}.json",
                result_data.test_case
            );
            let ref_file = reference_dir.join(&ref_file_name);

            if !ref_file.exists() {
                println!(
                    "  {} No reference file for test case: {}",
                    "⚠".yellow(),
                    result_data.test_case.bright_white()
                );
                continue;
            }

            let ref_data: VisibilityResult =
                serde_json::from_str(&fs::read_to_string(&ref_file)?)?;

            // Compare window counts
            let result_windows = result_data.visibility_windows.len();
            let ref_windows = ref_data.visibility_windows.len();

            if result_windows == ref_windows {
                println!(
                    "  {} {} - {} window(s)",
                    "✓".green(),
                    result_data.test_case.bright_white(),
                    result_windows
                );
                match_count += 1;
            } else {
                println!(
                    "  {} {} - {} window(s) vs {} reference",
                    "✗".red(),
                    result_data.test_case.bright_white(),
                    result_windows.to_string().yellow(),
                    ref_windows.to_string().green()
                );
            }
        }

        println!();
        let validation_msg = format!("Validation: {}/{} test cases match reference", match_count, total_count);
        if match_count == total_count {
            println!("{}", validation_msg.green().bold());
        } else {
            println!("{}", validation_msg.yellow());
        }

        Ok(())
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let orchestrator = Orchestrator::new()?;

    match cli.command {
        Commands::Discover => {
            let implementations = orchestrator.discover_implementations()?;
            println!("{} {} implementation(s):", "Discovered".bold().bright_blue(), implementations.len().to_string().bright_white());
            for impl_ in &implementations {
                println!("  {} {}", "●".bright_cyan(), impl_.name.bright_white());
            }
        }

        Commands::Build { implementation } => {
            let implementations = orchestrator.discover_implementations()?;

            if let Some(name) = implementation {
                let impl_ = implementations
                    .iter()
                    .find(|i| i.name == name)
                    .context("Implementation not found")?;
                orchestrator.build_image(impl_)?;
            } else {
                for impl_ in &implementations {
                    if let Err(e) = orchestrator.build_image(impl_) {
                        eprintln!("  {} Error building {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red());
                    }
                }
            }
        }

        Commands::Run {
            implementation,
            test_case,
            build,
        } => {
            let implementations = orchestrator.discover_implementations()?;

            let impls_to_run: Vec<_> = if let Some(name) = implementation {
                implementations
                    .iter()
                    .filter(|i| i.name == name)
                    .cloned()
                    .collect()
            } else {
                implementations
            };

            if build {
                println!("\n{}", "Building images...".bold().bright_blue());
                println!("{}", "=".repeat(50).dimmed());
                for impl_ in &impls_to_run {
                    if let Err(e) = orchestrator.build_image(impl_) {
                        eprintln!("  {} Error building {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red());
                    }
                }
                println!();
            }

            println!("\n{}", "Running tests...".bold().bright_blue());
            println!("{}", "=".repeat(50).dimmed());
            let mut results = Vec::new();
            for impl_ in &impls_to_run {
                match orchestrator.run_tests(impl_, test_case.as_deref()) {
                    Ok(result) => results.push(result),
                    Err(e) => eprintln!("  {} Error running {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red()),
                }
            }

            println!();
            println!("{}", "Summary:".bold().bright_green());
            println!("{}", "=".repeat(50).dimmed());
            for result in &results {
                if result.success {
                    println!(
                        "{} {} - {}",
                        "✓".green(),
                        result.implementation.bright_white(),
                        format!("{:.2}s", result.execution_time).bright_white()
                    );
                } else {
                    println!(
                        "{} {} - {}",
                        "✗".red(),
                        result.implementation.bright_white(),
                        format!("{:.2}s", result.execution_time).dimmed()
                    );
                }
            }
        }

        Commands::Validate { implementation } => {
            if let Some(name) = implementation {
                orchestrator.validate_results(&name)?;
            } else {
                let implementations = orchestrator.discover_implementations()?;
                for impl_ in &implementations {
                    orchestrator.validate_results(&impl_.name)?;
                    println!();
                }
            }
        }

        Commands::All { test_case } => {
            let implementations = orchestrator.discover_implementations()?;

            println!("\n{}", "Satellite Visibility Test Suite".bold().bright_magenta());
            println!("{}", "=".repeat(50).dimmed());
            println!("Discovered {} implementation(s)", implementations.len().to_string().bright_white());
            for impl_ in &implementations {
                println!("  {} {}", "●".bright_cyan(), impl_.name.bright_white());
            }
            println!();

            println!("\n{}", "Building images...".bold().bright_blue());
            println!("{}", "-".repeat(50).dimmed());
            for impl_ in &implementations {
                if let Err(e) = orchestrator.build_image(impl_) {
                    eprintln!("  {} Error building {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red());
                }
            }
            println!();

            println!("\n{}", "Running tests...".bold().bright_blue());
            println!("{}", "-".repeat(50).dimmed());
            let mut results = Vec::new();
            for impl_ in &implementations {
                match orchestrator.run_tests(impl_, test_case.as_deref()) {
                    Ok(result) => results.push(result),
                    Err(e) => eprintln!("  {} Error running {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red()),
                }
            }
            println!();

            println!("\n{}", "Validating results...".bold().bright_blue());
            println!("{}", "-".repeat(50).dimmed());
            for impl_ in &implementations {
                if let Err(e) = orchestrator.validate_results(&impl_.name) {
                    eprintln!("  {} Error validating {}: {}", "✗".red(), impl_.name.bright_white(), e.to_string().red());
                }
            }

            println!();
            println!("{}", "Final Summary:".bold().bright_green());
            println!("{}", "=".repeat(50).dimmed());
            for result in &results {
                if result.success {
                    println!(
                        "{} {} - {}",
                        "✓".green(),
                        result.implementation.bright_white(),
                        format!("{:.2}s", result.execution_time).bright_white()
                    );
                } else {
                    println!(
                        "{} {} - {}",
                        "✗".red(),
                        result.implementation.bright_white(),
                        format!("{:.2}s", result.execution_time).dimmed()
                    );
                }
            }
        }
    }

    Ok(())
}
