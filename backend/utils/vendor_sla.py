from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(slots=True)
class SlaPrediction:
    predicted_value: float
    threshold: float
    breach_probability: float
    is_breach: bool


def predict_sla_breach(values: Iterable[float], threshold: float) -> SlaPrediction:
    # Adapted from the SLA predictor repo's values -> model.predict(values) -> threshold comparison flow.
    series = [float(value) for value in values]
    if not series:
        return SlaPrediction(predicted_value=0.0, threshold=threshold, breach_probability=0.0, is_breach=False)

    weights = [index + 1 for index in range(len(series))]
    weighted_total = sum(value * weight for value, weight in zip(series, weights, strict=False))
    predicted = weighted_total / sum(weights)
    ratio = predicted / threshold if threshold > 0 else 0.0
    probability = max(0.0, min(1.0, ratio - 1.0 if ratio > 1 else ratio * 0.5))
    return SlaPrediction(
        predicted_value=round(predicted, 4),
        threshold=threshold,
        breach_probability=round(probability, 4),
        is_breach=predicted > threshold,
    )
