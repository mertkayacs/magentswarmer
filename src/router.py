# Task router: maps task types to the right provider and model.
# Input: task type string and optional cost/quality preference.
# Output: (provider, model) tuple.
# Invariant: routing decisions are stateless and deterministic given inputs.

from dataclasses import dataclass
from enum import Enum


class TaskType(Enum):
    ORCHESTRATION = "orchestration"   # complex reasoning, planning, coordination
    CODE = "code"                     # code generation and debugging
    RESEARCH = "research"             # web-search-backed research and summarization
    ANALYSIS = "analysis"             # data analysis, structured output
    QUICK = "quick"                   # fast lookup, classification, short answers
    CREATIVE = "creative"             # writing, brainstorming


class CostProfile(Enum):
    CHEAPEST = "cheapest"
    BALANCED = "balanced"
    BEST = "best"


@dataclass
class RouteDecision:
    provider: str
    model: str
    rationale: str


# Routing table: (task_type, cost_profile) -> (provider, model, rationale)
# Model names here should be verified against provider APIs before use.
ROUTING_TABLE: dict[tuple[TaskType, CostProfile], RouteDecision] = {
    (TaskType.ORCHESTRATION, CostProfile.BEST): RouteDecision(
        "claude", "claude-opus-4-7",
        "Opus excels at multi-step reasoning and coordination with long context"
    ),
    (TaskType.ORCHESTRATION, CostProfile.BALANCED): RouteDecision(
        "claude", "claude-sonnet-4-6",
        "Sonnet handles orchestration well at lower cost than Opus"
    ),
    (TaskType.CODE, CostProfile.BEST): RouteDecision(
        "claude", "claude-opus-4-7",
        "Opus produces the most reliable and correct code"
    ),
    (TaskType.CODE, CostProfile.BALANCED): RouteDecision(
        "openai", "gpt-4o",
        "GPT-4o is strong on code with competitive pricing"
    ),
    (TaskType.CODE, CostProfile.CHEAPEST): RouteDecision(
        "openai", "gpt-4o-mini",
        "GPT-4o-mini handles routine code tasks at low cost"
    ),
    (TaskType.RESEARCH, CostProfile.BEST): RouteDecision(
        "gemini", "gemini-2.5-pro",
        "Gemini Pro handles large context and web grounding well"
    ),
    (TaskType.RESEARCH, CostProfile.BALANCED): RouteDecision(
        "gemini", "gemini-2.0-flash",
        "Gemini Flash is fast and cheap for research summarization"
    ),
    (TaskType.ANALYSIS, CostProfile.BEST): RouteDecision(
        "claude", "claude-opus-4-7",
        "Opus produces the most reliable structured analysis"
    ),
    (TaskType.ANALYSIS, CostProfile.BALANCED): RouteDecision(
        "claude", "claude-sonnet-4-6",
        "Sonnet handles structured analysis at reasonable cost"
    ),
    (TaskType.QUICK, CostProfile.CHEAPEST): RouteDecision(
        "claude", "claude-haiku-4-5-20251001",
        "Haiku is optimized for fast, cheap single-turn tasks"
    ),
    (TaskType.QUICK, CostProfile.BALANCED): RouteDecision(
        "openai", "gpt-4o-mini",
        "GPT-4o-mini is fast and cheap for simple tasks"
    ),
    (TaskType.CREATIVE, CostProfile.BEST): RouteDecision(
        "claude", "claude-opus-4-7",
        "Opus produces the strongest creative and narrative output"
    ),
    (TaskType.CREATIVE, CostProfile.BALANCED): RouteDecision(
        "openai", "gpt-4o",
        "GPT-4o is strong for creative tasks"
    ),
}


def route(
    task_type: TaskType,
    cost_profile: CostProfile = CostProfile.BALANCED,
) -> RouteDecision:
    key = (task_type, cost_profile)
    if key in ROUTING_TABLE:
        return ROUTING_TABLE[key]
    # Fall back to balanced orchestration if no exact match
    return ROUTING_TABLE[(TaskType.ORCHESTRATION, CostProfile.BALANCED)]
