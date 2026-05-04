# Worker agent base class.
# Input: task dict with prompt, model, provider.
# Output: WorkerResult with response text and metadata.
# Invariant: each worker is stateless; all context is passed in the task.

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class WorkerTask:
    task_id: str
    prompt: str
    provider: str  # "claude", "openai", "gemini"
    model: str
    system_prompt: str = ""
    max_tokens: int = 2048
    metadata: dict = field(default_factory=dict)


@dataclass
class WorkerResult:
    task_id: str
    provider: str
    model: str
    response: str
    tokens_used: int
    latency_ms: float
    success: bool
    error: str = ""


class BaseWorker:
    def __init__(self, provider: str, model: str):
        self.provider = provider
        self.model = model

    async def run(self, task: WorkerTask) -> WorkerResult:
        raise NotImplementedError


class ClaudeWorker(BaseWorker):
    def __init__(self, model: str = "claude-sonnet-4-6"):
        super().__init__("claude", model)
        import anthropic
        self.client = anthropic.AsyncAnthropic()

    async def run(self, task: WorkerTask) -> WorkerResult:
        start = time.monotonic()
        try:
            messages = [{"role": "user", "content": task.prompt}]
            kwargs: dict[str, Any] = {
                "model": self.model,
                "max_tokens": task.max_tokens,
                "messages": messages,
            }
            if task.system_prompt:
                kwargs["system"] = task.system_prompt

            response = await self.client.messages.create(**kwargs)
            text = response.content[0].text
            tokens = response.usage.input_tokens + response.usage.output_tokens
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model,
                response=text,
                tokens_used=tokens,
                latency_ms=(time.monotonic() - start) * 1000,
                success=True,
            )
        except Exception as e:
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model,
                response="",
                tokens_used=0,
                latency_ms=(time.monotonic() - start) * 1000,
                success=False,
                error=str(e),
            )


class OpenAIWorker(BaseWorker):
    def __init__(self, model: str = "gpt-4o-mini"):
        super().__init__("openai", model)
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI()

    async def run(self, task: WorkerTask) -> WorkerResult:
        start = time.monotonic()
        try:
            messages = []
            if task.system_prompt:
                messages.append({"role": "system", "content": task.system_prompt})
            messages.append({"role": "user", "content": task.prompt})

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=task.max_tokens,
            )
            text = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else 0
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model,
                response=text,
                tokens_used=tokens,
                latency_ms=(time.monotonic() - start) * 1000,
                success=True,
            )
        except Exception as e:
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model,
                response="",
                tokens_used=0,
                latency_ms=(time.monotonic() - start) * 1000,
                success=False,
                error=str(e),
            )


class GeminiWorker(BaseWorker):
    def __init__(self, model: str = "gemini-2.0-flash"):
        super().__init__("gemini", model)
        import google.generativeai as genai
        import os
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        self.genai = genai
        self.model_name = model

    async def run(self, task: WorkerTask) -> WorkerResult:
        start = time.monotonic()
        try:
            model = self.genai.GenerativeModel(
                self.model_name,
                system_instruction=task.system_prompt or None,
            )
            # Gemini SDK is sync; run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: model.generate_content(task.prompt)
            )
            text = response.text
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model_name,
                response=text,
                tokens_used=0,  # Gemini usage metadata varies by version
                latency_ms=(time.monotonic() - start) * 1000,
                success=True,
            )
        except Exception as e:
            return WorkerResult(
                task_id=task.task_id,
                provider=self.provider,
                model=self.model_name,
                response="",
                tokens_used=0,
                latency_ms=(time.monotonic() - start) * 1000,
                success=False,
                error=str(e),
            )


WORKER_REGISTRY: dict[str, type[BaseWorker]] = {
    "claude": ClaudeWorker,
    "openai": OpenAIWorker,
    "gemini": GeminiWorker,
}
