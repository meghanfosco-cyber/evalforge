"use client";

import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Layers3,
  MousePointerClick,
  Scale,
  ShieldAlert,
  Sparkles,
  SplitSquareHorizontal,
  Wand2
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type RubricKey = "text" | "image" | "screenshot" | "agent";
type Severity = "Low" | "Medium" | "High";

type CategoryScore = {
  name: string;
  a: number;
  b: number;
  note: string;
};

type EvaluationResult = {
  winner: "A" | "B" | "Tie";
  confidence: number;
  severity: Severity;
  categories: CategoryScore[];
  issues: string[];
  justification: string;
};

type EvaluationInput = {
  prompt: string;
  responseA: string;
  responseB: string;
  notes: string;
};

const rubricPresets: Record<
  RubricKey,
  {
    label: string;
    description: string;
    categories: string[];
    icon: ReactNode;
  }
> = {
  text: {
    label: "Text Evaluation",
    description: "Judge factuality, completeness, clarity, instruction following, and tone.",
    categories: ["Instruction Fit", "Factuality", "Completeness", "Clarity", "Tone Control"],
    icon: <FileText className="h-4 w-4" aria-hidden />
  },
  image: {
    label: "Image Generation Comparison",
    description: "Compare prompt adherence, visual quality, composition, artifacts, and safety.",
    categories: ["Prompt Match", "Composition", "Visual Fidelity", "Artifact Control", "Safety"],
    icon: <Sparkles className="h-4 w-4" aria-hidden />
  },
  screenshot: {
    label: "UI Screenshot Description",
    description: "Review layout recognition, interaction detail, accessibility cues, and omissions.",
    categories: ["Layout Accuracy", "Element Coverage", "State Detail", "Accessibility", "Conciseness"],
    icon: <Layers3 className="h-4 w-4" aria-hidden />
  },
  agent: {
    label: "Agent Tool-Use Review",
    description: "Audit planning, tool selection, evidence handling, recovery, and final answer quality.",
    categories: ["Plan Quality", "Tool Choice", "Evidence Use", "Recovery", "User Outcome"],
    icon: <MousePointerClick className="h-4 w-4" aria-hidden />
  }
};

const demoEvaluations: Array<EvaluationInput & { title: string; rubric: RubricKey }> = [
  {
    title: "Text QA: LinkedIn Launch Post",
    rubric: "text",
    prompt:
      "Write a concise LinkedIn post announcing EvalForge, an AI evaluation and prompt QA studio. Use a professional but enthusiastic tone, explain structured rubrics, and include a clear call to action.",
    responseA:
      "Excited to share EvalForge, an AI evaluation and prompt QA studio for comparing model responses with structured rubrics, clear scoring, and evaluator-ready justifications. If your team is tightening AI quality workflows, take a look and tell me what you would measure first.",
    responseB:
      "I built a new AI tool. It checks responses and has some scoring features. More updates soon.",
    notes: "Reward professional tone, specific explanation of the tool, clarity, conciseness, enthusiasm, and a useful call to action."
  },
  {
    title: "Image QA: Product Scene",
    rubric: "image",
    prompt:
      "Compare two generated images for a premium reusable water bottle on a granite kitchen counter in morning light.",
    responseA:
      "The image shows a brushed steel bottle with clean reflections, believable granite texture, and morning light from frame left. The cap is slightly warped.",
    responseB:
      "The bottle is visible, but the scene has plastic-looking metal, inconsistent shadows, and distracting extra objects behind the product.",
    notes: "Brand-safe, realistic materials, no distorted logos, and clear hero product visibility."
  },
  {
    title: "UI QA: Dashboard Description",
    rubric: "screenshot",
    prompt:
      "Compare two descriptions of a dashboard screenshot for a QA analyst. The best answer should mention navigation, filters, table state, empty/error states, and accessibility cues.",
    responseA:
      "The screenshot shows a dashboard with a left navigation rail, date and owner filters, a sortable issues table, status badges, and a visible empty-state panel. It also notes keyboard focus on the export button and labels the chart axes.",
    responseB:
      "It is a dashboard with charts, a table, and some buttons at the top.",
    notes: "Reward precise UI element coverage, state recognition, accessibility detail, and concise wording."
  },
  {
    title: "Agent QA: Research Workflow",
    rubric: "agent",
    prompt:
      "Assess an agent run that searched docs, summarized API changes, and recommended migration steps for a developer.",
    responseA:
      "The agent checked the current docs, cited relevant model migration pages, flagged one uncertainty, and gave ordered steps with rollback notes.",
    responseB:
      "The agent answered from memory, did not cite the docs, and mixed old and new model names in the final recommendation.",
    notes: "Reward tool use only when it improves evidence quality and reduces migration risk."
  }
];

const demoByRubric = Object.fromEntries(demoEvaluations.map((demo) => [demo.rubric, demo])) as Record<
  RubricKey,
  EvaluationInput & { title: string; rubric: RubricKey }
>;

const emptyInput: EvaluationInput = {
  prompt: "",
  responseA: "",
  responseB: "",
  notes: ""
};

function scoreText(text: string, salt: number) {
  const trimmed = text.trim();
  const lengthScore = Math.min(35, Math.floor(trimmed.length / 18));
  const detailScore = ["because", "specific", "clear", "evidence", "step", "risk", "user", "accurate"].reduce(
    (sum, word) => sum + (trimmed.toLowerCase().includes(word) ? 4 : 0),
    0
  );
  const structureScore = /[.;:]/.test(trimmed) ? 8 : 2;
  return Math.max(42, Math.min(96, 52 + lengthScore + detailScore + structureScore - salt));
}

function firstUsefulSentence(text: string, fallback: string) {
  const sentence = text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .find((item) => item.length > 24);
  if (!sentence) {
    return fallback;
  }
  return sentence.length > 150 ? `${sentence.slice(0, 147).trim()}...` : sentence;
}

function includesCue(text: string, cues: string[]) {
  const lower = text.toLowerCase();
  return cues.some((cue) => lower.includes(cue));
}

function joinNatural(items: string[]) {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function keywordRequirements(prompt: string, notes: string) {
  const source = `${prompt} ${notes}`.toLowerCase();
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "being",
    "clear",
    "could",
    "their",
    "there",
    "these",
    "those",
    "under",
    "using",
    "while",
    "would"
  ]);
  const words = source.match(/[a-z][a-z-]{4,}/g) ?? [];
  return Array.from(new Set(words.filter((word) => !stopWords.has(word)))).slice(0, 4);
}

function textRequirements(prompt: string, notes: string) {
  const source = `${prompt} ${notes}`.toLowerCase();
  const possible = [
    {
      label: "the subscription renewal and cancellation concern",
      promptCues: ["subscription", "renew", "renewed", "cancel", "cancelled", "canceled"],
      responseCues: ["subscription", "renew", "renewal", "cancel", "cancellation"]
    },
    {
      label: "concrete next steps",
      promptCues: ["next step", "next steps"],
      responseCues: ["next step", "next steps", "check", "confirm", "contact", "share"]
    },
    {
      label: "concise support language",
      promptCues: ["support reply", "customer support"],
      responseCues: ["help", "sorry", "understand", "contact", "support"]
    },
    {
      label: "professional tone",
      promptCues: ["professional", "linkedin", "post", "announcement"],
      responseCues: ["professional", "excited", "proud", "built", "launch", "share"]
    },
    {
      label: "clear enthusiasm",
      promptCues: ["enthusiasm", "enthusiastic", "excited", "linkedin", "post"],
      responseCues: ["excited", "thrilled", "proud", "energized", "launch", "share"]
    },
    {
      label: "a clear explanation of the tool",
      promptCues: ["explain", "tool", "product", "evalforge", "studio"],
      responseCues: ["evalforge", "tool", "studio", "helps", "compare", "evaluate"]
    },
    {
      label: "structured rubrics",
      promptCues: ["rubric", "rubrics", "structured", "evaluation", "evalforge"],
      responseCues: ["rubric", "rubrics", "structured", "score", "criteria", "evaluate"]
    },
    {
      label: "clarity and conciseness",
      promptCues: ["clear", "clarity", "concise", "conciseness", "brief"],
      responseCues: ["clear", "concise", "brief", "focused", "simple"]
    },
    {
      label: "a call to action",
      promptCues: ["call to action", "cta", "invite", "linkedin", "post"],
      responseCues: ["try", "check", "share", "comment", "connect", "follow", "learn"]
    },
    {
      label: "careful handling of refund or billing escalation",
      promptCues: ["refund", "billing"],
      responseCues: ["refund", "billing", "eligible", "review"]
    },
    {
      label: "non-blaming language",
      promptCues: ["no blame", "empathetic", "blame"],
      responseCues: ["sorry", "surprise", "help", "check"]
    },
    {
      label: "avoiding unsupported promises",
      promptCues: ["unsupported", "promise", "promises"],
      responseCues: ["eligible", "review", "check", "confirm"]
    }
  ];

  const detected = possible.filter((requirement) => includesCue(source, requirement.promptCues));
  if (detected.length > 0) {
    return detected;
  }

  return keywordRequirements(prompt, notes).map((keyword) => ({
    label: `the prompt detail "${keyword}"`,
    promptCues: [keyword],
    responseCues: [keyword]
  }));
}

function responseWeaknesses(response: string, missedRequirements: string[]) {
  const lower = response.toLowerCase();
  const weaknesses = missedRequirements.map((requirement) => `misses ${requirement}`);
  if (includesCue(lower, ["you did not", "did not cancel correctly", "your fault", "incorrectly"])) {
    weaknesses.push("uses blaming language instead of a professional tone");
  }
  if (includesCue(lower, ["probably", "try again later", "some", "stuff", "things"])) {
    weaknesses.push("relies on vague or speculative wording");
  }
  if (!/[.;:]/.test(response)) {
    weaknesses.push("does not give the evaluator a clear structured answer");
  }
  return Array.from(new Set(weaknesses)).slice(0, 3);
}

function textJustification(input: EvaluationInput, winner: "A" | "B" | "Tie") {
  const requirements = textRequirements(input.prompt, input.notes);
  const responseBySide = {
    A: input.responseA,
    B: input.responseB
  };

  if (winner === "Tie") {
    const sharedRequirements = requirements
      .filter(
        (requirement) =>
          includesCue(input.responseA, requirement.responseCues) && includesCue(input.responseB, requirement.responseCues)
      )
      .map((requirement) => requirement.label)
      .slice(0, 2);
    const sharedText =
      sharedRequirements.length > 0
        ? `Both responses address ${joinNatural(sharedRequirements)}.`
        : "Both responses cover some of the prompt but leave important evaluation questions unresolved.";
    return `${sharedText} The comparison is close because neither response clearly provides a stronger answer to "${firstUsefulSentence(
      input.prompt,
      "the task prompt"
    )}". The tie would break toward the response with more specific prompt coverage, fewer assumptions, and a clearer action or takeaway.`;
  }

  const loser = winner === "A" ? "B" : "A";
  const winningResponse = responseBySide[winner];
  const losingResponse = responseBySide[loser];
  const satisfied = requirements
    .filter((requirement) => includesCue(winningResponse, requirement.responseCues))
    .map((requirement) => requirement.label)
    .slice(0, 3);
  const missed = requirements
    .filter((requirement) => !includesCue(losingResponse, requirement.responseCues))
    .map((requirement) => requirement.label)
    .slice(0, 3);
  const weaknesses = responseWeaknesses(losingResponse, missed);
  const winningDetails =
    satisfied.length > 0
      ? `It covers ${joinNatural(satisfied)}.`
      : `It more directly responds to the task prompt: "${firstUsefulSentence(input.prompt, "the requested task")}".`;
  const losingDetails =
    weaknesses.length > 0
      ? `Response ${loser} is weaker because it ${joinNatural(weaknesses)}.`
      : `Response ${loser} is weaker because it gives less concrete detail from the prompt and leaves the evaluator with fewer task-specific signals.`;

  return `Response ${winner} is stronger for this Text Evaluation task. ${winningDetails} It gives concrete detail such as "${firstUsefulSentence(
    winningResponse,
    `Response ${winner}`
  )}" instead of staying generic. ${losingDetails} The losing response says "${firstUsefulSentence(
    losingResponse,
    `Response ${loser}`
  )}", which does not fully satisfy the prompt requirements.`;
}

function generalJustification(input: EvaluationInput, presetLabel: string, winner: "A" | "B" | "Tie") {
  const promptDetail = firstUsefulSentence(input.prompt, "the task prompt");
  if (presetLabel === "Image Generation Comparison") {
    if (winner === "Tie") {
      return `Both responses perform similarly because each keeps the subject connected to "${promptDetail}" and gives evaluators visual signals to compare. Response A has an edge when its composition, lighting, product clarity, texture, and reflections feel more realistic; Response B would only pull ahead if it showed cleaner background consistency or fewer visual artifacts. Since neither response clearly outperforms the other across realism, premium feel, prompt adherence, and artifact control, this is best treated as a close image comparison.`;
    }

    const loser = winner === "A" ? "B" : "A";
    const winningResponse = winner === "A" ? input.responseA : input.responseB;
    const losingResponse = loser === "A" ? input.responseA : input.responseB;
    return `Response ${winner} is stronger for this image comparison because it gives a more convincing read on composition, lighting, product clarity, realism, and premium feel for "${promptDetail}". Its visual evidence includes "${firstUsefulSentence(
      winningResponse,
      `Response ${winner}`
    )}". Response ${loser} is weaker where "${firstUsefulSentence(
      losingResponse,
      `Response ${loser}`
    )}" suggests less consistent texture, background control, or artifact handling.`;
  }

  if (presetLabel === "UI Screenshot Description") {
    if (winner === "Tie") {
      return `Both written descriptions are close because each captures some visible UI structure from "${promptDetail}". Response A is stronger if it describes the screenshot with clearer references to layout, navigation rail, filters, table structure, status badges, empty state, and interaction details; Response B would only pull ahead if its description named more labels, hierarchy, and state changes. Since neither written response is clearly more useful for a QA analyst across layout accuracy, element coverage, and visual evidence, this remains a close UI description comparison.`;
    }

    const loser = winner === "A" ? "B" : "A";
    const winningResponse = winner === "A" ? input.responseA : input.responseB;
    const losingResponse = loser === "A" ? input.responseA : input.responseB;
    return `Response ${winner} is stronger for this UI Screenshot Description task because it provides a more useful written description of the screenshot. It captures visible UI elements such as hierarchy, labels, filters, navigation rail, table structure, status badges, empty state, and interaction details, with specifics like "${firstUsefulSentence(
      winningResponse,
      `Response ${winner}`
    )}". Response ${loser} is weaker because "${firstUsefulSentence(
      losingResponse,
      `Response ${loser}`
    )}" stays too broad to describe the screenshot's layout, state, accessibility details, or interaction cues for a QA analyst.`;
  }

  if (winner === "Tie") {
    return `Both responses are close under the ${presetLabel} preset because neither one clearly separates itself on "${promptDetail}". Response A offers "${firstUsefulSentence(
      input.responseA,
      "Response A"
    )}", while Response B offers "${firstUsefulSentence(
      input.responseB,
      "Response B"
    )}". The tie holds because the strengths and weaknesses balance out across coverage, clarity, and prompt adherence.`;
  }

  const loser = winner === "A" ? "B" : "A";
  const winningResponse = winner === "A" ? input.responseA : input.responseB;
  const losingResponse = loser === "A" ? input.responseA : input.responseB;
  return `Response ${winner} is stronger under the ${presetLabel} preset because it more directly addresses "${promptDetail}". It includes concrete observable detail such as "${firstUsefulSentence(
    winningResponse,
    `Response ${winner}`
  )}", while Response ${loser} is less complete with "${firstUsefulSentence(
    losingResponse,
    `Response ${loser}`
  )}". That difference explains the category-score gap and gives evaluators a clearer basis for the winner selection.`;
}

function createEvaluation(input: EvaluationInput, rubric: RubricKey): EvaluationResult {
  const preset = rubricPresets[rubric];
  const baseA = scoreText(input.responseA, 1);
  const baseB = scoreText(input.responseB, 0);
  const promptBoost = input.prompt.length > 120 ? 3 : 0;
  const contextBoost = input.notes.length > 80 ? 2 : 0;

  const categories = preset.categories.map((name, index) => {
    const swing = (index % 3) * 3;
    const a = Math.max(35, Math.min(98, baseA + promptBoost - swing + (index === 0 ? 4 : 0)));
    const b = Math.max(35, Math.min(98, baseB + contextBoost - (6 - swing) + (index === 2 ? 3 : 0)));
    const note =
      a === b
        ? "Both responses land close together on this dimension."
        : a > b
          ? "Response A gives evaluators more usable signal here."
          : "Response B is stronger on this rubric dimension.";
    return { name, a, b, note };
  });

  const totalA = categories.reduce((sum, item) => sum + item.a, 0);
  const totalB = categories.reduce((sum, item) => sum + item.b, 0);
  const gap = Math.abs(totalA - totalB) / categories.length;
  const winner = gap < 3 ? "Tie" : totalA > totalB ? "A" : "B";
  const severity: Severity = gap > 16 ? "High" : gap > 8 ? "Medium" : "Low";
  const weaker = winner === "B" ? "A" : "B";
  const issueSubject = winner === "Tie" ? "Both responses" : `Response ${weaker}`;
  const justification =
    rubric === "text" ? textJustification(input, winner) : generalJustification(input, preset.label, winner);
  const issues =
    rubric === "screenshot"
      ? [
          `${issueSubject} needs stronger coverage of visible UI layout, hierarchy, labels, and screen state.`,
          `${issueSubject} should name concrete interface elements such as filters, navigation rail, status badges, table structure, empty state, or interaction cues.`,
          severity === "High"
            ? "The UI description gap is large enough to affect screenshot QA decisions."
            : "The comparison is close, but the weaker answer still misses visual evidence that would make the screenshot easier to verify."
        ]
      : [
          `${issueSubject} needs tighter alignment to the selected ${preset.label} rubric.`,
          `${issueSubject} leaves room for more explicit evidence, constraints, or user-facing next steps.`,
          severity === "High"
            ? "The quality gap is large enough to affect production QA decisions."
            : "The observed gap is manageable but should be captured for reviewer calibration."
        ];

  return {
    winner,
    confidence: Math.min(96, Math.round(68 + gap * 1.8)),
    severity,
    categories,
    issues,
    justification
  };
}

function ScoreBar({ label, value, side }: { label: string; value: number; side: "A" | "B" }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-graphite">
        <span>{label}</span>
        <span>Response {side}: {value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={side === "A" ? "h-full rounded-full bg-forge-500" : "h-full rounded-full bg-cobalt-500"}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"overview" | "workspace">("overview");
  const [rubric, setRubric] = useState<RubricKey>("text");
  const [isRubricOpen, setIsRubricOpen] = useState(true);
  const [input, setInput] = useState<EvaluationInput>(demoEvaluations[0]);
  const [result, setResult] = useState<EvaluationResult>(() =>
    createEvaluation(demoEvaluations[0], demoEvaluations[0].rubric)
  );

  const selectedPreset = rubricPresets[rubric];
  const totalScore = useMemo(() => {
    const totals = result.categories.reduce(
      (acc, item) => ({ a: acc.a + item.a, b: acc.b + item.b }),
      { a: 0, b: 0 }
    );
    return {
      a: Math.round(totals.a / result.categories.length),
      b: Math.round(totals.b / result.categories.length)
    };
  }, [result]);

  function runEvaluation() {
    setResult(createEvaluation(input, rubric));
    setActiveTab("workspace");
  }

  function loadDemo(index: number) {
    const demo = demoEvaluations[index];
    loadDemoForRubric(demo.rubric);
  }

  function loadDemoForRubric(rubricKey: RubricKey) {
    const demo = demoByRubric[rubricKey];
    setRubric(demo.rubric);
    setInput({
      prompt: demo.prompt,
      responseA: demo.responseA,
      responseB: demo.responseB,
      notes: demo.notes
    });
    setResult(createEvaluation(demo, demo.rubric));
    setActiveTab("workspace");
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <button
            className="focus-ring flex items-center gap-3 rounded-md text-left"
            onClick={() => setActiveTab("overview")}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white shadow-line">
              <Wand2 className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-black tracking-wide text-ink">EvalForge</span>
              <span className="block text-xs font-semibold text-graphite">AI Evaluation & Prompt QA Studio</span>
            </span>
          </button>
          <nav className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-line sm:flex">
            {(["overview", "workspace"] as const).map((tab) => (
              <button
                key={tab}
                className={`focus-ring rounded-md px-4 py-2 text-sm font-bold capitalize transition ${
                  activeTab === tab ? "bg-ink text-white" : "text-graphite hover:bg-slate-100 hover:text-ink"
                }`}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-black text-white shadow-line transition hover:bg-forge-700"
            onClick={() => {
              setActiveTab("workspace");
              document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
            }}
            type="button"
          >
            Open Studio
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {activeTab === "overview" && (
        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-forge-100 bg-white px-3 py-1.5 text-sm font-bold text-forge-700 shadow-line">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              Structured review for serious model QA
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-ink sm:text-5xl lg:text-6xl">
              EvalForge: AI Evaluation & Prompt QA Studio
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-graphite">
              Compare two model responses with reusable rubrics, calibrated severity, transparent scoring, and
              audit-ready justifications built for evaluator teams.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5"
                onClick={() => setActiveTab("workspace")}
                type="button"
              >
                Start Evaluating
                <ClipboardCheck className="h-4 w-4" aria-hidden />
              </button>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-ink shadow-line transition hover:border-forge-500"
                onClick={() => loadDemo(2)}
                type="button"
              >
                Load Agent Demo
                <Boxes className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-10 grid metric-grid gap-4">
              {[
                ["4", "Rubric presets"],
                ["100+", "Character rationale"],
                ["2", "Response lanes"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-line">
                  <div className="text-2xl font-black text-ink">{value}</div>
                  <div className="mt-1 text-sm font-semibold text-graphite">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="rounded-xl border border-slate-200 bg-mist p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-ink">Live comparison preview</div>
                  <div className="text-xs font-semibold text-graphite">Response A vs Response B</div>
                </div>
                <span className="rounded-full bg-forge-100 px-3 py-1 text-xs font-black text-forge-700">
                  Winner {result.winner}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-4 shadow-line">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black text-forge-700">Response A</span>
                    <span className="text-lg font-black text-ink">{totalScore.a}</span>
                  </div>
                  <p className="text-sm leading-6 text-graphite">{input.responseA}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow-line">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-black text-cobalt-700">Response B</span>
                    <span className="text-lg font-black text-ink">{totalScore.b}</span>
                  </div>
                  <p className="text-sm leading-6 text-graphite">{input.responseB}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-4 shadow-line">
                <div className="mb-3 flex items-center gap-2 text-sm font-black text-ink">
                  <BarChart3 className="h-4 w-4 text-ember-600" aria-hidden />
                  Rubric signal
                </div>
                <div className="space-y-3">
                  {result.categories.slice(0, 3).map((category) => (
                    <ScoreBar key={category.name} label={category.name} value={category.a} side="A" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="workspace" className={activeTab === "workspace" ? "block" : "hidden"}>
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-forge-700">Evaluation workspace</p>
              <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Compare, score, and justify</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {demoEvaluations.map((demo, index) => (
                <button
                  key={demo.title}
                  className="focus-ring rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-graphite shadow-line transition hover:border-forge-500 hover:text-ink"
                  onClick={() => loadDemo(index)}
                  type="button"
                >
                  {demo.title}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-line">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-ink">Rubric preset</h3>
                    <p className="text-sm font-semibold text-graphite">Choose the review lens for this comparison.</p>
                  </div>
                  <button
                    aria-controls="rubric-preset-options"
                    aria-expanded={isRubricOpen}
                    aria-label={isRubricOpen ? "Collapse rubric presets" : "Expand rubric presets"}
                    className="focus-ring rounded-md p-1 text-graphite transition hover:bg-slate-100 hover:text-ink"
                    onClick={() => setIsRubricOpen((current) => !current)}
                    type="button"
                  >
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${isRubricOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
                {isRubricOpen && (
                  <div id="rubric-preset-options" className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(rubricPresets) as RubricKey[]).map((key) => (
                      <button
                        key={key}
                        className={`focus-ring rounded-lg border p-4 text-left transition ${rubric === key ? "border-forge-500 bg-forge-50 shadow-line" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                        onClick={() => loadDemoForRubric(key)}
                        type="button"
                      >
                        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-white">
                          {rubricPresets[key].icon}
                        </span>
                        <span className="block text-sm font-black text-ink">{rubricPresets[key].label}</span>
                        <span className="mt-1 block text-xs leading-5 text-graphite">
                          {rubricPresets[key].description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-line">
                <div className="mb-4 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-ember-600" aria-hidden />
                  <h3 className="text-lg font-black text-ink">Inputs</h3>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-ink">Task prompt</span>
                    <textarea
                      className="focus-ring min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-ink shadow-line"
                      value={input.prompt}
                      onChange={(event) => setInput({ ...input, prompt: event.target.value })}
                      placeholder="Paste the task prompt being evaluated..."
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-forge-700">Response A</span>
                      <textarea
                        className="focus-ring min-h-40 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-ink shadow-line"
                        value={input.responseA}
                        onChange={(event) => setInput({ ...input, responseA: event.target.value })}
                        placeholder="Paste response A..."
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black text-cobalt-700">Response B</span>
                      <textarea
                        className="focus-ring min-h-40 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-ink shadow-line"
                        value={input.responseB}
                        onChange={(event) => setInput({ ...input, responseB: event.target.value })}
                        placeholder="Paste response B..."
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-ink">Context notes</span>
                    <textarea
                      className="focus-ring min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-ink shadow-line"
                      value={input.notes}
                      onChange={(event) => setInput({ ...input, notes: event.target.value })}
                      placeholder="Add policy, product, evaluator, or dataset context..."
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    className="focus-ring inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-forge-600 px-5 py-3 text-sm font-black text-white shadow-line transition hover:bg-forge-700"
                    onClick={runEvaluation}
                    type="button"
                  >
                    Evaluate
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    className="focus-ring inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-graphite shadow-line transition hover:text-ink"
                    onClick={() => {
                      setInput(emptyInput);
                      setResult(createEvaluation(emptyInput, rubric));
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-ink p-5 text-white shadow-soft">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-bold text-forge-100">{selectedPreset.label}</p>
                    <h3 className="mt-1 text-2xl font-black">Structured result</h3>
                  </div>
                  <div className="rounded-lg bg-white/10 px-4 py-3 text-right shadow-line">
                    <div className="text-xs font-bold text-slate-200">Winner</div>
                    <div className="text-3xl font-black">Response {result.winner}</div>
                  </div>
                </div>
                <div className="mt-5 grid metric-grid gap-3">
                  <div className="rounded-lg bg-white/10 p-4 shadow-line">
                    <div className="text-xs font-bold text-slate-200">Score A</div>
                    <div className="mt-1 text-3xl font-black">{totalScore.a}</div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-4 shadow-line">
                    <div className="text-xs font-bold text-slate-200">Score B</div>
                    <div className="mt-1 text-3xl font-black">{totalScore.b}</div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-4 shadow-line">
                    <div className="text-xs font-bold text-slate-200">Confidence</div>
                    <div className="mt-1 text-3xl font-black">{result.confidence}%</div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-4 shadow-line">
                    <div className="text-xs font-bold text-slate-200">Issue severity</div>
                    <div className="mt-1 text-3xl font-black">{result.severity}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-line">
                <div className="mb-4 flex items-center gap-2">
                  <SplitSquareHorizontal className="h-5 w-5 text-cobalt-700" aria-hidden />
                  <h3 className="text-lg font-black text-ink">Category scores</h3>
                </div>
                <div className="space-y-5">
                  {result.categories.map((category) => (
                    <div key={category.name} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-black text-ink">{category.name}</h4>
                        <p className="text-xs font-semibold text-graphite">{category.note}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ScoreBar label={category.name} value={category.a} side="A" />
                        <ScoreBar label={category.name} value={category.b} side="B" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-line">
                  <div className="mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-ember-600" aria-hidden />
                    <h3 className="text-lg font-black text-ink">Issues</h3>
                  </div>
                  <div className="space-y-3">
                    {result.issues.map((issue) => (
                      <div key={issue} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forge-600" aria-hidden />
                        <p className="text-sm leading-6 text-graphite">{issue}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-line">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-forge-700" aria-hidden />
                    <h3 className="text-lg font-black text-ink">Justification</h3>
                  </div>
                  <p className="text-sm leading-7 text-graphite">{result.justification}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
