# Swarm coordinator: spawns workers, runs tasks in parallel, collects results.
# Input: list of WorkerTask objects.
# Output: list of WorkerResult objects in completion order.
# Invariant: tasks are independent; the swarm does not guarantee ordering.

import asyncio
import uuid
from typing import Callable

from worker import BaseWorker, WorkerResult, WorkerTask, WORKER_REGISTRY


class Swarm:
    def __init__(self, max_concurrency: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self._workers: dict[str, BaseWorker] = {}

    def _get_worker(self, provider: str, model: str) -> BaseWorker:
        key = f"{provider}:{model}"
        if key not in self._workers:
            worker_cls = WORKER_REGISTRY[provider]
            self._workers[key] = worker_cls(model=model)
        return self._workers[key]

    async def _run_single(
        self,
        task: WorkerTask,
        on_complete: Callable[[WorkerResult], None] | None = None,
    ) -> WorkerResult:
        async with self.semaphore:
            worker = self._get_worker(task.provider, task.model)
            result = await worker.run(task)
            if on_complete:
                on_complete(result)
            return result

    async def run(
        self,
        tasks: list[WorkerTask],
        on_complete: Callable[[WorkerResult], None] | None = None,
    ) -> list[WorkerResult]:
        coroutines = [self._run_single(t, on_complete) for t in tasks]
        return await asyncio.gather(*coroutines)

    def make_task(
        self,
        prompt: str,
        provider: str,
        model: str,
        system_prompt: str = "",
        max_tokens: int = 2048,
        metadata: dict | None = None,
    ) -> WorkerTask:
        return WorkerTask(
            task_id=str(uuid.uuid4())[:8],
            prompt=prompt,
            provider=provider,
            model=model,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            metadata=metadata or {},
        )
