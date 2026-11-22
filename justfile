# Default recipe: list available commands
default:
    @just --list

# Link every plugin in this checkout into OpenCode's global plugin directory
link-plugins:
    ./scripts/link-plugins.sh

# Remove the links created by `just link-plugins`
unlink-plugins:
    ./scripts/link-plugins.sh --remove

# Link every agent in this checkout into OpenCode's global agents directory
link-agents:
    ./scripts/link-agents.sh

# Remove the links created by `just link-agents`
unlink-agents:
    ./scripts/link-agents.sh --remove

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
