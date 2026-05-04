# Cost vs quality scatter chart for major LLM providers.
# Input: hardcoded model data (update as pricing changes).
# Output: saves chart as model_cost_quality.png in this directory.

import os

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# Cost per 1M output tokens (USD) and quality score (MMLU-Pro or equivalent, 0-100 scale)
# Sources: provider pricing pages and public benchmarks, May 2025
MODELS = [
    # name, cost_per_1m_output, quality_score, provider, role
    ("Claude Haiku",       1.25,  72, "anthropic", "worker"),
    ("Claude Sonnet",      15.0,  85, "anthropic", "worker"),
    ("Claude Opus",        75.0,  93, "anthropic", "orchestrator"),
    ("GPT-4o mini",         0.6,  70, "openai",    "worker"),
    ("GPT-4o",             10.0,  85, "openai",    "worker"),
    ("Gemini Flash",        0.3,  68, "google",    "worker"),
    ("Gemini Pro",          2.5,  80, "google",    "worker"),
]

COLORS = {
    "anthropic": "#c0392b",
    "openai":    "#27ae60",
    "google":    "#2980b9",
}

MARKERS = {
    "orchestrator": "D",
    "worker":       "o",
}


def main():
    fig, ax = plt.subplots(figsize=(10, 6))

    for name, cost, quality, provider, role in MODELS:
        ax.scatter(
            cost, quality,
            c=COLORS[provider],
            marker=MARKERS[role],
            s=180 if role == "orchestrator" else 100,
            zorder=3,
            edgecolors="white",
            linewidths=0.8,
        )
        ax.annotate(
            name,
            (cost, quality),
            textcoords="offset points",
            xytext=(8, 4),
            fontsize=8,
            color="#333333",
        )

    # Ideal frontier: high quality, low cost -- upper-left is best
    ax.axhline(80, linestyle="--", color="#aaaaaa", linewidth=0.8, label="quality threshold")

    ax.set_xscale("log")
    ax.set_xlabel("Cost per 1M output tokens (USD, log scale)", fontsize=11)
    ax.set_ylabel("Quality score (benchmark composite, 0-100)", fontsize=11)
    ax.set_title("LLM Cost vs Quality -- Routing Target Zone", fontsize=13, fontweight="bold")
    ax.grid(True, which="both", linestyle=":", alpha=0.4)

    legend_patches = [
        mpatches.Patch(color=COLORS["anthropic"], label="Anthropic"),
        mpatches.Patch(color=COLORS["openai"],    label="OpenAI"),
        mpatches.Patch(color=COLORS["google"],    label="Google"),
        plt.Line2D([0], [0], marker="D", color="gray", linestyle="None", label="Orchestrator role"),
        plt.Line2D([0], [0], marker="o", color="gray", linestyle="None", label="Worker role"),
    ]
    ax.legend(handles=legend_patches, fontsize=9, loc="lower right")

    out = os.path.join(os.path.dirname(__file__), "model_cost_quality.png")
    plt.tight_layout()
    plt.savefig(out, dpi=150)
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
