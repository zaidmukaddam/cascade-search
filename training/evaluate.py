import argparse
import json
from datetime import date

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn.functional as F

from data import DATA, IGNORED_LABEL, ROOT, load, token_mask
from model import load_checkpoint

TARGETS = (0.99, 0.995, 0.999)
SELECTION_TARGET = "0.995"
SELECTION_TOLERANCE = 0.001
CALIBRATION_BINS = 15
SHARES = np.round(np.concatenate([np.arange(0, 0.1, 0.005), np.arange(0.1, 0.51, 0.02)]), 3)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default="ckpt.pt")
    parser.add_argument("--out", default="../eval/results/m2.json")
    return parser.parse_args()


def infer(model, path, feature_count):
    features, labels, _ = load(path, feature_count)
    with torch.no_grad():
        logits, confidence = model(features.float(), token_mask(labels))
    real = labels != IGNORED_LABEL
    return logits[real], confidence[real], labels[real]


def fit_temperature(logits, labels) -> float:
    log_temperature = torch.zeros(1, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_temperature], lr=0.1, max_iter=100)

    def closure():
        optimizer.zero_grad()
        loss = F.cross_entropy(logits / log_temperature.exp(), labels)
        loss.backward()
        return loss

    optimizer.step(closure)
    return log_temperature.exp().item()


def confidence_signals(logits, head_logits, temperature):
    probabilities = F.softmax(logits / temperature, -1)
    entropy = -(probabilities * probabilities.clamp_min(1e-12).log()).sum(-1)
    normalized_entropy = entropy / np.log(probabilities.shape[-1])
    return {
        "softmax": probabilities.max(-1).values.numpy(),
        "entropy": (1 - normalized_entropy).numpy(),
        "head": torch.sigmoid(head_logits).numpy(),
    }


def expected_calibration_error(confidence, correct):
    edges = np.linspace(0, 1, CALIBRATION_BINS + 1)
    error = 0.0
    bins = []
    for low, high in zip(edges[:-1], edges[1:], strict=True):
        inside = (confidence > low) & (confidence <= high)
        if not inside.any():
            continue
        mean_confidence = float(confidence[inside].mean())
        accuracy = float(correct[inside].mean())
        error += inside.mean() * abs(mean_confidence - accuracy)
        bins.append(
            {
                "lo": round(low, 3),
                "hi": round(high, 3),
                "n": int(inside.sum()),
                "conf": mean_confidence,
                "acc": accuracy,
            }
        )
    return float(error), bins


def auroc(confidence, correct) -> float:
    order = np.argsort(confidence)
    ranks = np.empty(len(confidence))
    ranks[order] = np.arange(1, len(confidence) + 1)
    right, wrong = correct.sum(), (~correct).sum()
    if not right or not wrong:
        return float("nan")
    return float((ranks[correct].sum() - right * (right + 1) / 2) / (right * wrong))


def errors_fixed_by_rank(confidence, correct):
    order = np.argsort(confidence, kind="stable")
    return np.concatenate([[0], np.cumsum((~correct)[order])])


def escalation_curve(confidence, correct):
    fixed = errors_fixed_by_rank(confidence, correct)
    count, errors = len(confidence), (~correct).sum()
    return [float(1 - (errors - fixed[int(round(share * count))]) / count) for share in SHARES]


def escalation_rate_for(confidence, correct, target) -> float:
    remaining = (~correct).sum() - errors_fixed_by_rank(confidence, correct)
    reached = np.nonzero(1 - remaining / len(confidence) >= target)[0]
    return float(reached[0] / len(confidence))


def report(logits, head_logits, labels, temperature):
    correct = (logits.argmax(-1) == labels).numpy()
    accuracy = float(correct.mean())
    methods = {}
    for name, confidence in confidence_signals(logits, head_logits, temperature).items():
        error, reliability = expected_calibration_error(confidence, correct)
        methods[name] = {
            "ece": error,
            "auroc": auroc(confidence, correct),
            "reliability": reliability,
            "curve": escalation_curve(confidence, correct),
            "escalationRateAt": {
                str(target): escalation_rate_for(confidence, correct, target) for target in TARGETS
            },
        }
    return {
        "tokens": len(labels),
        "accuracy": accuracy,
        "random": [float(accuracy + (1 - accuracy) * share) for share in SHARES],
        "methods": methods,
        "randomRateAt": {
            str(target): float(max(0.0, (target - accuracy) / (1 - accuracy))) for target in TARGETS
        },
    }


def choose_signal(heldout_methods) -> str:
    def rate(name: str) -> float:
        return heldout_methods[name]["escalationRateAt"][SELECTION_TARGET]

    best_rate = min(rate(name) for name in heldout_methods)
    contenders = [name for name in heldout_methods if rate(name) <= best_rate + SELECTION_TOLERANCE]
    return min(contenders, key=lambda name: heldout_methods[name]["ece"])


def print_summary(results):
    for split in ("heldout", "transfer"):
        section = results[split]
        print(
            f"\n{split}: token accuracy {section['accuracy']:.4f} over {section['tokens']} tokens"
        )
        random_rate = section["randomRateAt"][SELECTION_TARGET]
        for name, method in section["methods"].items():
            rate = method["escalationRateAt"][SELECTION_TARGET]
            print(
                f"  {name:8} ece {method['ece']:.4f}  auroc {method['auroc']:.4f}"
                f"  escalate for 99.5%: {rate:.2%}  (random {random_rate:.2%})"
            )
    print(f"\ntemperature {results['temperature']:.3f}; chosen: {results['chosen']}")


def plot(results, path):
    plt.switch_backend("Agg")
    transfer, chosen = results["transfer"], results["chosen"]
    shares = SHARES * 100
    figure, (curve_axis, reliability_axis) = plt.subplots(1, 2, figsize=(11, 4.2))

    for name, method in transfer["methods"].items():
        curve_axis.plot(
            shares,
            np.array(method["curve"]) * 100,
            label=f"lowest {name} confidence first",
            lw=2 if name == chosen else 1,
        )
    curve_axis.plot(shares, np.array(transfer["random"]) * 100, "--", color="gray", label="random")
    curve_axis.set(
        xlabel="% of tokens escalated",
        ylabel="token accuracy after escalation (%)",
        title="Transfer domains: escalation curve",
        xlim=(0, 30),
    )
    curve_axis.legend()
    curve_axis.grid(alpha=0.3)

    shipped = transfer["methods"][chosen]
    bins = shipped["reliability"]
    reliability_axis.plot([0, 1], [0, 1], "--", color="gray")
    reliability_axis.plot([b["conf"] for b in bins], [b["acc"] for b in bins], "o-")
    reliability_axis.set(
        xlabel="stated confidence",
        ylabel="observed accuracy",
        title=f"Reliability ({chosen}, ECE {shipped['ece']:.3f})",
    )
    reliability_axis.grid(alpha=0.3)

    figure.tight_layout()
    figure.savefig(path, dpi=140)


def main():
    args = parse_args()
    model, checkpoint = load_checkpoint(ROOT / args.ckpt)
    feature_count = checkpoint["features"]

    val_logits, val_head, val_labels = infer(model, DATA / "val.jsonl", feature_count)
    transfer_logits, transfer_head, transfer_labels = infer(
        model, DATA / "transfer.jsonl", feature_count
    )
    half = len(val_labels) // 2
    temperature = fit_temperature(val_logits[:half], val_labels[:half])

    results = {
        "date": date.today().isoformat(),
        "parameters": sum(p.numel() for p in model.parameters()),
        "temperature": temperature,
        "x": SHARES.tolist(),
        "heldout": report(val_logits[half:], val_head[half:], val_labels[half:], temperature),
        "transfer": report(transfer_logits, transfer_head, transfer_labels, temperature),
    }
    results["chosen"] = choose_signal(results["heldout"]["methods"])

    output = (ROOT / args.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, indent=1))
    print_summary(results)
    plot(results, output.with_suffix(".png"))
    print("wrote", output)


if __name__ == "__main__":
    main()
