# Orchestrator agent: breaks a high-level goal into subtasks, routes them to workers, synthesizes results.
# Input: user goal string, cost profile preference.
# Output: synthesized final answer string.
# Invariant: the orchestrator model is always the most capable available (Opus-class).

import asyncio
import json
import os
from typing import Any

import anthropic

from router import CostProfile, TaskType, route
from swarm import Swarm
from worker import WorkerTask


ORCHESTRATOR_MODEL = "claude-opus-4-7"

DECOMPOSE_SYSTEM = """You are a task orchestrator. Your job is to decompose a complex user goal into independent subtasks that can be run in parallel by different AI agents.

Return a JSON array of subtask objects. Each object must have:
- "id": short unique string
- "prompt": the full prompt for this subtask
- "task_type": one of orchestration, code, research, analysis, quick, creative
- "cost_profile": one of cheapest, balanced, best

Rules:
- Tasks must be independent (no task depends on another's output at this stage)
- Be specific in each prompt so a worker can complete it without additional context
- Use cost_profile "cheapest" or "balanced" for most tasks; "best" only when quality is critical
- Return only the JSON array, no prose"""

SYNTHESIZE_SYSTEM = """You are a synthesis expert. You receive the results from multiple parallel AI agents that each worked on a piece of a larger goal. Combine their outputs into a single, coherent, high-quality response to the original goal.

Be direct. Do not pad. Do not repeat what you are doing, just do it."""


class Orchestrator:
    def __init__(self, cost_profile: CostProfile = CostProfile.BALANCED):
        self.client = anthropic.AsyncAnthropic()
        self.swarm = Swarm()
        self.default_cost = cost_profile

    async def _decompose(self, goal: str) -> list[dict[str, Any]]:
        response = await self.client.messages.create(
            model=ORCHESTRATOR_MODEL,
            max_tokens=2048,
            system=DECOMPOSE_SYSTEM,
            messages=[{"role": "user", "content": f"Goal: {goal}"}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(raw)

    async def _synthesize(self, goal: str, results: list[dict]) -> str:
        summary = "\n\n".join(
            f"[{r['id']} | {r['provider']} {r['model']}]\n{r['response']}"
            for r in results
            if r.get("success")
        )
        response = await self.client.messages.create(
            model=ORCHESTRATOR_MODEL,
            max_tokens=4096,
            system=SYNTHESIZE_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": f"Original goal: {goal}\n\nAgent outputs:\n{summary}",
                }
            ],
        )
        return response.content[0].text

    async def run(self, goal: str, verbose: bool = True) -> str:
        if verbose:
            print(f"[orchestrator] decomposing goal...")
        subtasks_raw = await self._decompose(goal)

        tasks: list[WorkerTask] = []
        for s in subtasks_raw:
            task_type = TaskType(s.get("task_type", "quick"))
            cost = CostProfile(s.get("cost_profile", self.default_cost.value))
            decision = route(task_type, cost)
            tasks.append(
                self.swarm.make_task(
                    prompt=s["prompt"],
                    provider=decision.provider,
                    model=decision.model,
                    metadata={"id": s["id"]},
                )
            )
            if verbose:
                print(f"  task {s['id']}: {decision.provider}/{decision.model} ({decision.rationale})")

        if verbose:
            print(f"[orchestrator] running {len(tasks)} tasks in parallel...")

        def on_done(result):
            if verbose:
                status = "ok" if result.success else f"FAILED: {result.error}"
                print(f"  [{result.task_id}] {result.provider}/{result.model} done in {result.latency_ms:.0f}ms -- {status}")

        results = await self.swarm.run(tasks, on_complete=on_done)

        result_dicts = []
        for task, result in zip(tasks, results):
            result_dicts.append({
                "id": task.metadata.get("id", task.task_id),
                "provider": result.provider,
                "model": result.model,
                "response": result.response,
                "success": result.success,
                "error": result.error,
            })

        if verbose:
            print("[orchestrator] synthesizing...")
        return await self._synthesize(goal, result_dicts)


async def main():
    goal = os.environ.get(
        "SWARM_GOAL",
        "Summarize the current state of multi-agent AI systems and their main open problems."
    )
    orchestrator = Orchestrator()
    result = await orchestrator.run(goal)
    print("\n--- FINAL RESULT ---\n")
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
