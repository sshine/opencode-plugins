# The platforms every output is evaluated for. A plugin is plain TypeScript with no
# native build, so all four work; drop any that stop being useful.
{ ... }:
{
  systems = [
    "x86_64-linux"
    "aarch64-linux"
    "x86_64-darwin"
    "aarch64-darwin"
  ];
}
