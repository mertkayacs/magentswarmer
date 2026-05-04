# Research demo: orchestrator sends the same research question to 3 workers simultaneously.
# Input: RESEARCH_TOPIC env var or default topic.
# Output: each worker's response printed, then synthesized answer.
# Shows: true parallel execution across Claude, GPT, and Gemini.

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from swarm import Swarm
from worker import WorkerTask

TOPIC = os.environ.get(
    "RESEARCH_TOPIC",
    "What are the main open problems in multi-agent AI systems as of 2025?"
)

WORKERS = [
    {"provider": "claude",  "model": "claude-sonnet-4-6"},
    {"provider": "openai",  "model": "gpt-4o-mini"},
    {"provider": "gemini",  "model": "gemini-2.0-flash"},
]


async def main():
    swarm = Swarm()

    tasks = [
        WorkerTask(
            task_id=f"research-{w['provider']}",
            prompt=TOPIC,
            provider=w["provider"],
            model=w["model"],
            system_prompt="Answer concisely in 3-5 bullet points. Be specific and cite real examples.",
            max_tokens=512,
        )
        for w in WORKERS
    ]

    print(f"Topic: {TOPIC}\n")
    print(f"Running {len(tasks)} workers in parallel...\n")
    start = time.monotonic()

    results = await swarm.run(tasks)

    elapsed = time.monotonic() - start
    print(f"All done in {elapsed:.1f}s\n")
    print("=" * 60)

    for result in results:
        status = "OK" if result.success else f"FAILED: {result.error}"
        print(f"\n[{result.provider} / {result.model}] ({result.latency_ms:.0f}ms) -- {status}")
        print("-" * 40)
        if result.success:
            print(result.response)
        print()


if __name__ == "__main__":
    asyncio.run(main())
