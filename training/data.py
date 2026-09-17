import json
from pathlib import Path

import torch

ROOT = Path(__file__).parent
DATA = ROOT / "data"
MAX_TOKENS = 24
IGNORED_LABEL = -1


def read_meta() -> dict:
    return json.loads((DATA / "meta.json").read_text())


def load(path: Path, feature_count: int):
    rows = [json.loads(line) for line in path.read_text().splitlines() if line]
    features = torch.zeros(len(rows), MAX_TOKENS, feature_count, dtype=torch.uint8)
    labels = torch.full((len(rows), MAX_TOKENS), IGNORED_LABEL, dtype=torch.long)
    for index, row in enumerate(rows):
        for token, (active, label) in enumerate(zip(row["f"], row["y"], strict=True)):
            features[index, token, active] = 1
            labels[index, token] = label
    return features, labels, rows


def token_mask(labels: torch.Tensor) -> torch.Tensor:
    return (labels != IGNORED_LABEL).unsqueeze(-1).float()
