.PHONY: console rust docker validate
console:
	cd apps/console && npm ci && npm run dev
rust:
	cargo run -p tunnara-coordinator
validate:
	npm run validate
	cargo fmt --all --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings
docker:
	cd deploy/docker && docker compose up -d --build
