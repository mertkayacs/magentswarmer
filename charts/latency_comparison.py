# Latency comparison bar chart: sequential vs parallel swarm execution.
# Input: simulated timing data (replace with real benchmark output from demo_compare.py).
# Output: saves chart as latency_comparison.png in this directory.

import os

import matplotlib.pyplot as plt
import numpy as np

# Median time-to-first-token (TTFT) in milliseconds, approximate values from public benchmarks
# Replace with your own measurements from demo_compare.py for accuracy
MODELS = [
    "Claude Haiku",
    "Claude Sonnet",
    "GPT-4o mini",
    "GPT-4o",
    "Gemini Flash",
]

LATENCIES_MS = [380, 820, 420, 750, 310]


def main():
    sequential_total = sum(LATENCIES_MS)
    parallel_total = max(LATENCIES_MS)  # wall-clock when all run at once

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Left: per-model latency
    ax = axes[0]
    colors = ["#c0392b", "#c0392b", "#27ae60", "#27ae60", "#2980b9"]
    bars = ax.barh(MODELS, LATENCIES_MS, color=colors, edgecolor="white", height=0.6)
    ax.set_xlabel("Latency (ms)", fontsize=11)
    ax.set_title("Per-model TTFT (approximate)", fontsize=12, fontweight="bold")
    ax.grid(True, axis="x", linestyle=":", alpha=0.4)
    for bar, val in zip(bars, LATENCIES_MS):
        ax.text(val + 10, bar.get_y() + bar.get_height() / 2,
                f"{val}ms", va="center", fontsize=9)

    # Right: sequential vs parallel total
    ax2 = axes[1]
    configs = ["Sequential\n(one by one)", "Parallel\n(magentswarmer)"]
    totals = [sequential_total, parallel_total]
    bar_colors = ["#e74c3c", "#2ecc71"]
    bars2 = ax2.bar(configs, totals, color=bar_colors, width=0.4, edgecolor="white")
    ax2.set_ylabel("Total wall-clock time (ms)", fontsize=11)
    ax2.set_title("Sequential vs Parallel Execution", fontsize=12, fontweight="bold")
    ax2.grid(True, axis="y", linestyle=":", alpha=0.4)
    for bar, val in zip(bars2, totals):
        ax2.text(bar.get_x() + bar.get_width() / 2, val + 20,
                 f"{val}ms", ha="center", fontsize=10, fontweight="bold")

    speedup = sequential_total / parallel_total
    ax2.text(0.5, 0.85, f"{speedup:.1f}x faster",
             transform=ax2.transAxes, ha="center", fontsize=13,
             color="#27ae60", fontweight="bold")

    out = os.path.join(os.path.dirname(__file__), "latency_comparison.png")
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
