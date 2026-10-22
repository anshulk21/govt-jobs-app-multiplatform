#!/usr/bin/env bash
# Turns a fresh Ubuntu server in India (e.g. Oracle Cloud Always Free, Mumbai or Hyderabad) into a
# GitHub Actions runner for the "monitor-india" job. README → "Server in India" has the full steps.
#
# Run on the server as the normal "ubuntu" user (not root):
#   curl -fsSL https://raw.githubusercontent.com/anshulk21/govt-jobs-app-multiplatform/main/scripts/server/setup-india-runner.sh | bash -s -- <RUNNER_TOKEN>
#
# <RUNNER_TOKEN>: GitHub → repository → Settings → Actions → Runners → New self-hosted runner →
# the value after --token (valid for 1 hour). Safe to run again; it replaces the old registration.
set -euo pipefail

TOKEN="${1:?Usage: setup-india-runner.sh <RUNNER_TOKEN> [REPO_URL]}"
REPO_URL="${2:-https://github.com/anshulk21/govt-jobs-app-multiplatform}"
DIR="$HOME/actions-runner"

if [ "$(id -u)" = 0 ]; then
  echo "Run this as the normal user (e.g. ubuntu), not root." >&2
  exit 1
fi

# Small free servers have 1 GB of memory; npm ci needs more, so add swap once.
if ! swapon --show | grep -q /swapfile; then
  echo "Adding 4 GB swap..."
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "Installing git, curl, jq and the GitHub CLI..."
sudo apt-get update -qq
sudo apt-get install -y -qq git curl jq ca-certificates >/dev/null
if ! command -v gh >/dev/null; then
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq gh >/dev/null
fi

case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *) echo "Unsupported CPU: $(uname -m)" >&2; exit 1 ;;
esac
VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r .tag_name | sed 's/^v//')"
echo "Installing GitHub Actions runner $VERSION ($ARCH)..."
mkdir -p "$DIR"
cd "$DIR"
if [ -f .runner ]; then
  # Re-running: stop and unregister the old one first.
  sudo ./svc.sh stop >/dev/null 2>&1 || true
  sudo ./svc.sh uninstall >/dev/null 2>&1 || true
fi
curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v$VERSION/actions-runner-linux-$ARCH-$VERSION.tar.gz"
tar xzf runner.tar.gz
rm runner.tar.gz
sudo ./bin/installdependencies.sh >/dev/null

./config.sh --unattended --replace --url "$REPO_URL" --token "$TOKEN" --name "india-$(hostname)" --labels india
sudo ./svc.sh install
sudo ./svc.sh start

echo
echo "Done. The runner starts automatically after reboots."
echo "Check: GitHub → Settings → Actions → Runners shows india-$(hostname) as Idle."
echo "Then set the repository variable INDIA_RUNNER to true (README → Server in India, step 5)."
