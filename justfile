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

# Lint the Nix sources (deadnix) and the TypeScript sources (oxlint)
lint:
    deadnix --fail .
    oxlint --deny-warnings plugins

# Evaluate the flake and run its checks
check:
    nix flake check

# Run all CI checks locally
ci: fmt-check lint typecheck check
    @echo "All CI checks passed!"
