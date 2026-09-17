import torch
import torch.nn as nn
import torch.nn.functional as F

INT6_MAX = 31
MIN_SCALE = 1e-8


def fake_quantize(weight: torch.Tensor) -> torch.Tensor:
    scale = weight.abs().amax(dim=1, keepdim=True).clamp_min(MIN_SCALE) / INT6_MAX
    quantized = (weight / scale).round().clamp(-INT6_MAX, INT6_MAX) * scale
    return weight + (quantized - weight).detach()


class QuantizedLinear(nn.Linear):
    quantize = False

    def forward(self, x):
        weight = fake_quantize(self.weight) if self.quantize else self.weight
        return F.linear(x, weight, self.bias)


class GatedScan(nn.Module):
    def __init__(self, width: int, reverse: bool):
        super().__init__()
        self.a = QuantizedLinear(width, width)
        self.u = QuantizedLinear(width, width)
        self.reverse = reverse

    def forward(self, hidden, mask):
        keep = torch.sigmoid(self.a(hidden))
        candidate = self.u(hidden)
        tokens = hidden.shape[1]
        state = hidden.new_zeros(hidden.shape[0], hidden.shape[2])
        states = [None] * tokens
        order = range(tokens - 1, -1, -1) if self.reverse else range(tokens)
        for token in order:
            updated = keep[:, token] * state + (1 - keep[:, token]) * candidate[:, token]
            state = torch.where(mask[:, token] > 0, updated, state)
            states[token] = state
        return torch.stack(states, 1)


class ScanLayer(nn.Module):
    def __init__(self, width: int):
        super().__init__()
        self.f = GatedScan(width, reverse=False)
        self.b = GatedScan(width, reverse=True)
        self.o = QuantizedLinear(2 * width, width)

    def forward(self, hidden, mask):
        both = torch.cat([self.f(hidden, mask), self.b(hidden, mask)], -1)
        return hidden + F.relu(self.o(both)) * mask


class MicroModel(nn.Module):
    def __init__(self, feature_count: int, role_count: int, width: int = 40, layers: int = 2):
        super().__init__()
        self.d = width
        self.k = role_count
        self.embed = QuantizedLinear(feature_count, width, bias=False)
        self.conv = QuantizedLinear(3 * width, width)
        self.layers = nn.ModuleList(ScanLayer(width) for _ in range(layers))
        self.head = QuantizedLinear(width, role_count)
        self.conf = QuantizedLinear(width + role_count, 1)

    def set_quantize(self, enabled: bool):
        for module in self.modules():
            if isinstance(module, QuantizedLinear):
                module.quantize = enabled

    def backbone_parameters(self):
        return [p for name, p in self.named_parameters() if not name.startswith("conf.")]

    def forward(self, features, mask):
        embedded = self.embed(features) * mask
        padded = F.pad(embedded, (0, 0, 1, 1))
        window = torch.cat([padded[:, :-2], embedded, padded[:, 2:]], -1)
        hidden = embedded + F.relu(self.conv(window)) * mask
        for layer in self.layers:
            hidden = layer(hidden, mask)
        logits = self.head(hidden)
        confidence_input = torch.cat([hidden.detach(), logits.detach()], -1)
        return logits, self.conf(confidence_input).squeeze(-1)


def load_checkpoint(path) -> tuple[MicroModel, dict]:
    checkpoint = torch.load(path)
    model = MicroModel(checkpoint["features"], len(checkpoint["roles"]))
    model.load_state_dict(checkpoint["state"])
    model.set_quantize(True)
    model.eval()
    return model, checkpoint
