#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

checkpoint=ckpt.pt
results=../eval/results/m2.json

if [[ "${1:-}" == "--restore" ]]; then
  uv run export.py --ckpt "$checkpoint" --results "$results"
  exit
fi

if [[ "${1:-}" == "--extra" ]]; then
  checkpoint=ckpt-m6.pt
  results=../eval/results/m6-after.json
fi

node gen.ts > /dev/null
uv run train.py --out "$checkpoint" "$@"
uv run evaluate.py --ckpt "$checkpoint" --out "$results"
uv run export.py --ckpt "$checkpoint" --results "$results"
