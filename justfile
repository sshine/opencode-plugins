# Default recipe: list available commands
default:
    @just --list

# Link every plugin in this checkout into OpenCode's global plugin directory
link:
    ./scripts/link-plugins.sh

# Remove the links created by `just link`
unlink:
    ./scripts/link-plugins.sh --remove

# Typecheck the plugins against the OpenCode plugin API
typecheck:
    bun run typecheck

# Format everything (Nix, TypeScript, JSON, Markdown, shell)
fmt:
    treefmt

# Check formatting without writing
fmt-check:
    treefmt --fail-on-change --no-cache

# Run dead-code lints over the Nix sources
lint:
    deadnix --fail .

# Evaluate the flake and run its checks
check:
    nix flake check

# Run all CI checks locally
ci: fmt-check lint check
    @echo "All CI checks passed!"
