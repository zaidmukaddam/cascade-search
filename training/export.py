import argparse
import base64
import json
import struct

import numpy as np
import torch

from data import DATA, ROOT, load, token_mask
from model import INT6_MAX, MIN_SCALE, load_checkpoint

ZERO_POINT = 32
VALUES_PER_GROUP = 4
BYTES_PER_GROUP = 3
GOLDEN_QUERIES = 64
CORE = ROOT.parent / "packages" / "core"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default="ckpt.pt")
    parser.add_argument("--results", default="../eval/results/m2.json")
    return parser.parse_args()


def pack_int6(matrix: np.ndarray) -> bytes:
    scale = (
        np.maximum(np.abs(matrix).max(1, keepdims=True), MIN_SCALE).astype(np.float32) / INT6_MAX
    )
    quantized = np.clip(np.round(matrix / scale), -INT6_MAX, INT6_MAX).astype(np.int64) + ZERO_POINT
    values = quantized.flatten()
    padding = np.zeros(-len(values) % VALUES_PER_GROUP, dtype=np.int64)
    groups = np.concatenate([values, padding]).reshape(-1, VALUES_PER_GROUP)
    words = groups[:, 0] | groups[:, 1] << 6 | groups[:, 2] << 12 | groups[:, 3] << 18
    packed = b"".join(struct.pack("<I", int(word))[:BYTES_PER_GROUP] for word in words)
    return scale.tobytes() + packed


def serialize(model):
    blob = bytearray()
    tensors = []
    for name, tensor in model.state_dict().items():
        array = tensor.numpy().astype(np.float32)
        tensors.append({"name": name, "shape": list(array.shape), "offset": len(blob)})
        blob += pack_int6(array) if array.ndim == 2 else array.tobytes()
    return bytes(blob), tensors


def golden_queries(model, feature_count):
    features, labels, rows = load(DATA / "transfer.jsonl", feature_count)
    features, labels, rows = (
        features[:GOLDEN_QUERIES],
        labels[:GOLDEN_QUERIES],
        rows[:GOLDEN_QUERIES],
    )
    with torch.no_grad():
        logits, confidence = model(features.float(), token_mask(labels))
    return [
        {
            "q": row["q"],
            "f": row["f"],
            "logits": logits[index, : len(row["f"])].tolist(),
            "conf": confidence[index, : len(row["f"])].tolist(),
        }
        for index, row in enumerate(rows)
    ]


def write_typescript_module(manifest, blob):
    encoded = base64.b64encode(blob).decode()
    source = (
        f"export const MANIFEST = {json.dumps(manifest)} as const\n"
        f"export const WEIGHTS_B64 = '{encoded}'\n"
    )
    (CORE / "src" / "weights.gen.ts").write_text(source)


def main():
    args = parse_args()
    model, checkpoint = load_checkpoint(ROOT / args.ckpt)
    results = json.loads((ROOT / args.results).read_text())
    blob, tensors = serialize(model)

    manifest = {
        "version": 1,
        "d": model.d,
        "layers": len(model.layers),
        "features": checkpoint["features"],
        "roles": checkpoint["roles"],
        "temperature": results["temperature"],
        "confidence": results["chosen"],
        "bits": 6,
        "tensors": tensors,
    }

    (CORE / "weights").mkdir(exist_ok=True)
    (CORE / "weights" / "weights.bin").write_bytes(blob)
    (CORE / "weights" / "manifest.json").write_text(json.dumps(manifest))
    write_typescript_module(manifest, blob)

    golden = golden_queries(model, checkpoint["features"])
    (CORE / "test" / "golden.json").write_text(json.dumps(golden))

    parameters = sum(int(np.prod(tensor["shape"])) for tensor in tensors)
    print(f"{len(blob)} bytes of weights, {parameters} parameters, {len(golden)} golden queries")


if __name__ == "__main__":
    main()
