import argparse

import torch
import torch.nn.functional as F

from data import DATA, IGNORED_LABEL, ROOT, load, read_meta, token_mask
from model import MicroModel

BATCH_SIZE = 256
LEARNING_RATE = 4e-3
WEIGHT_DECAY = 1e-4
LABEL_SMOOTHING = 0.02
FEATURE_DROPOUT = 0.03
CONFIDENCE_STEPS = 400
CONFIDENCE_LEARNING_RATE = 1e-2
CONFIDENCE_WEIGHT_DECAY = 1e-3
CONFIDENCE_FEATURE_DROPOUT = 0.05


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--extra")
    parser.add_argument("--extra-weight", type=int, default=20)
    parser.add_argument("--out", default="ckpt.pt")
    parser.add_argument("--epochs", type=int, default=14)
    parser.add_argument("--qat-epochs", type=int, default=4)
    return parser.parse_args()


def drop_features(features: torch.Tensor, rate: float) -> torch.Tensor:
    return features * (torch.rand_like(features) > rate)


def accuracy(model, features, labels) -> float:
    model.eval()
    with torch.no_grad():
        logits, _ = model(features.float(), token_mask(labels))
    real = labels != IGNORED_LABEL
    return ((logits.argmax(-1) == labels) & real).sum().item() / real.sum().item()


def training_set(args, feature_count):
    features, labels, _ = load(DATA / "train.jsonl", feature_count)
    if not args.extra:
        return features, labels
    extra_features, extra_labels, _ = load(ROOT / args.extra, feature_count)
    print(f"+ {len(extra_features)} logged escalations x{args.extra_weight}")
    features = torch.cat([features, extra_features.repeat(args.extra_weight, 1, 1)])
    labels = torch.cat([labels, extra_labels.repeat(args.extra_weight, 1)])
    return features, labels


def train_backbone(model, train, validation, float_epochs, quantized_epochs):
    features, labels = train
    epochs = float_epochs + quantized_epochs
    steps_per_epoch = (len(features) + BATCH_SIZE - 1) // BATCH_SIZE
    optimizer = torch.optim.AdamW(
        model.backbone_parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY
    )
    schedule = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=LEARNING_RATE, total_steps=epochs * steps_per_epoch
    )

    for epoch in range(epochs):
        quantized = epoch >= float_epochs
        model.set_quantize(quantized)
        model.train()
        for batch in torch.randperm(len(features)).split(BATCH_SIZE):
            batch_labels = labels[batch]
            batch_features = drop_features(features[batch].float(), FEATURE_DROPOUT)
            logits, _ = model(batch_features, token_mask(batch_labels))
            loss = F.cross_entropy(
                logits.flatten(0, 1),
                batch_labels.flatten(),
                ignore_index=IGNORED_LABEL,
                label_smoothing=LABEL_SMOOTHING,
            )
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            schedule.step()

        suffix = " (int6)" if quantized else ""
        score = accuracy(model, *validation)
        print(f"epoch {epoch + 1}/{epochs}{suffix}  loss {loss.item():.4f}  val acc {score:.4f}")


def train_confidence_head(model, features, labels):
    optimizer = torch.optim.AdamW(
        model.conf.parameters(),
        lr=CONFIDENCE_LEARNING_RATE,
        weight_decay=CONFIDENCE_WEIGHT_DECAY,
    )
    real = labels != IGNORED_LABEL
    model.eval()
    for _ in range(CONFIDENCE_STEPS):
        noisy = features.float() * (torch.rand(features.shape) > CONFIDENCE_FEATURE_DROPOUT)
        logits, confidence = model(noisy, token_mask(labels))
        was_right = (logits.argmax(-1) == labels)[real].float()
        loss = F.binary_cross_entropy_with_logits(confidence[real], was_right)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
    print(f"confidence head bce {loss.item():.4f}")


def main():
    args = parse_args()
    torch.manual_seed(0)
    meta = read_meta()
    feature_count, roles = meta["features"], meta["roles"]

    train = training_set(args, feature_count)
    validation_features, validation_labels, _ = load(DATA / "val.jsonl", feature_count)

    model = MicroModel(feature_count, len(roles))
    print("parameters:", sum(p.numel() for p in model.parameters()))

    train_backbone(
        model, train, (validation_features, validation_labels), args.epochs, args.qat_epochs
    )
    calibration_half = len(validation_features) // 2
    train_confidence_head(
        model, validation_features[:calibration_half], validation_labels[:calibration_half]
    )

    torch.save(
        {"state": model.state_dict(), "features": feature_count, "roles": roles}, ROOT / args.out
    )
    print("saved", args.out)


if __name__ == "__main__":
    main()
