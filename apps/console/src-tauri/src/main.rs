#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args = tunnara_console_lib::cli::args::CliArgs::parse();
    if tunnara_console_lib::cli::runner::should_run_without_tauri(&args) {
        if let Err(err) = tunnara_console_lib::cli::runner::run(args) {
            eprintln!("{err}");
            std::process::exit(1);
        }
        return;
    }
    tunnara_console_lib::run();
}
