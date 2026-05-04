# Benchmark demo: runs the same prompt across multiple models, compares latency and response quality.
# Input: BENCHMARK_PROMPT env var or default prompt.
# Output: side-by-side comparison table printed to stdout.
# Note: run this to get a rough sense of cost vs quality tradeoffs on your own workload.

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from swarm import Swarm
from worker import WorkerTask

PROMPT = os.environ.get(
    "BENCHMARK_PROMPT",
    "Explain the difference between a language model and a reasoning model in 2 sentences."
)

MODELS = [
    {"provider": "claude",  "model": "claude-haiku-4-5-20251001",  "label": "Claude Haiku"},
    {"provider": "claude",  "model": "claude-sonnet-4-6",          "label": "Claude Sonnet"},
    {"provider": "openai",  "model": "gpt-4o-mini",                "label": "GPT-4o mini"},
    {"provider": "openai",  "model": "gpt-4o",                     "label": "GPT-4o"},
    {"provider": "gemini",  "model": "gemini-2.0-flash",           "label": "Gemini Flash"},
]


async def main():
    swarm = Swarm()

    tasks = [
        WorkerTask(
            task_id=m["label"].replace(" ", "-").lower(),
            prompt=PROMPT,
            provider=m["provider"],
            model=m["model"],
            max_tokens=256,
            metadata={"label": m["label"]},
        )
        for m in MODELS
    ]

    print(f"Prompt: {PROMPT}\n")
    print(f"Running {len(tasks)} models...\n")
    start = time.monotonic()
    results = await swarm.run(tasks)
    total = time.monotonic() - start
    print(f"Done in {total:.1f}s (wall clock)\n")

    header = f"{'Model':<22} {'Latency':>10} {'Tokens':>8} {'Status':>10}"
    print(header)
    print("-" * len(header))

    for task, result in zip(tasks, results):
        label = task.metadata.get("label", result.model)
        status = "ok" if result.success else "FAILED"
        tokens = result.tokens_used if result.tokens_used else "n/a"
        print(f"{label:<22} {result.latency_ms:>9.0f}ms {str(tokens):>8} {status:>10}")

    print("\n--- Responses ---\n")
    for task, result in zip(tasks, results):
        label = task.metadata.get("label", result.model)
        print(f"[{label}]")
        if result.success:
            print(result.response.strip())
        else:
            print(f"Error: {result.error}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
