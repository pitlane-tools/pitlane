#!/usr/bin/env zsh
#MISE description="Vendor and update the official Remix agent skills with Rosie"

set -eu

mkdir -p ./.agents/skills/remix
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone \
  --depth 1 \
  --filter=blob:none \
  --sparse \
  https://github.com/remix-run/remix.git \
  "$tmp/remix"

git -C "$tmp/remix" sparse-checkout set ./.agents/skills/remix

rm -rf ./.agents/skills/remix
cp -R "$tmp/remix/.agents/skills/remix" ./.agents/skills/remix