// generate-context Flue agent.
// Authored under SLICE-006b of EXEC-20260515-platform-context-management.
// Locked: behavioural changes require a contract dispute against this slice.
//
// Shape: matches decisions/OQ-005-prompts-and-flue.md.
//   1. Assess significance (cheap model, bounded result schema).
//   2. If significant, generate updated context (better model, schema-bound).
//   3. Return a structured payload to the caller. Never write files; the
//      calling workflow performs all side effects (field forcing, file
//      writes, validator invocation, PR commits, metric emission).
//
// Read-only tool restriction: the agent does NOT pass `tools:` to init()
// or to skill() calls. Flue's default sandbox is in-memory with no tool
// surface; combined with the `local()` sandbox configured below for
// filesystem reads only, the agent has no path to bash, gh, git, or
// any filesystem-mutating call. AGENTS.md (LOCK-008) declares this
// invariant; this file enforces it via the absence of write-tool
// declarations.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type FlueContext } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import * as v from "valibot";

// --- Result schemas --------------------------------------------------

const Significance = v.object({
  significant: v.boolean(),
  rationale: v.pipe(v.string(), v.minLength(10), v.maxLength(400)),
  candidate_changed_fields: v.array(v.string()),
});

const Generation = v.object({
  context_index: v.record(v.string(), v.unknown()),
  context_detail: v.record(v.string(), v.unknown()),
});

// --- Skill metadata ---------------------------------------------------

const SKILLS_DIR = ".flue/skills";
const ASSESS_SKILL = "assess-significance";
const GENERATE_SKILL = "generate-context";
const SIGNIFICANCE_MODEL = "anthropic/bedrock-claude-4.6-sonnet";
const GENERATION_MODEL = "anthropic/bedrock-claude-4.7-opus";

function skillSha256(skillName: string, cwd: string): string {
  const path = resolve(cwd, `${SKILLS_DIR}/${skillName}.md`);
  const body = readFileSync(path);
  return createHash("sha256").update(body).digest("hex");
}

function emitCallLog(payload: {
  model: string;
  skill_name: string;
  skill_sha: string;
  call_mode: string;
  response_validated_against: string;
}): void {
  // Single-line structured JSON on stdout. SLICE-006c-a's workflow
  // captures this verbatim into the PR step summary.
  process.stdout.write(JSON.stringify(payload) + "\n");
}

// --- Agent entry point -----------------------------------------------

interface GenerateContextPayload {
  capability_id: string;
  pr_number: number;
  diff_path: string;
  previous_index_path: string;
  previous_detail_path: string;
}

export const triggers = {};

export default async function generateContext(
  ctx: FlueContext<GenerateContextPayload>,
): Promise<unknown> {
  const cwd = process.cwd();

  const harness = await ctx.init({
    sandbox: local({
      env: {
        // Only env vars the agent legitimately needs. GH_TOKEN flows
        // through for the read-only context the harness might need;
        // the agent never calls gh.
        GH_TOKEN: process.env.GH_TOKEN ?? "",
        LLM_GATEWAY_URL: process.env.LLM_GATEWAY_URL ?? "",
      },
    }),
    // Default model for both calls. Per-call `model:` overrides on the
    // generate skill (Opus) and per the harness default applies to
    // assess (Sonnet).
    model: SIGNIFICANCE_MODEL,
    // Read-only invariant: no tools registered at the harness level.
    // The skill calls below do not pass tools either. Flue's default
    // surface for skills is the file content (read-only) plus the
    // model's intrinsic ability to follow instructions in the prompt.
    tools: [],
  });

  const session = await harness.session();

  // --- Significance assessment ---------------------------------------

  const assessSha = skillSha256(ASSESS_SKILL, cwd);
  emitCallLog({
    model: SIGNIFICANCE_MODEL,
    skill_name: ASSESS_SKILL,
    skill_sha: assessSha,
    call_mode: "assess",
    response_validated_against: "Significance",
  });
  const assessHandle = session.skill(ASSESS_SKILL, {
    args: {
      capability_id: ctx.payload.capability_id,
      pr_number: ctx.payload.pr_number,
      diff_path: ctx.payload.diff_path,
      previous_index_path: ctx.payload.previous_index_path,
      previous_detail_path: ctx.payload.previous_detail_path,
    },
    result: Significance,
    // Read-only: no tools pass-through; skill body's read-via-prompt
    // pattern is the only path to fixture files.
    tools: [],
  });
  const { data: assessment } = await assessHandle;

  if (!assessment.significant) {
    return { mode: "skipped" as const, assessment };
  }

  // --- Generation -----------------------------------------------------

  const generateSha = skillSha256(GENERATE_SKILL, cwd);
  emitCallLog({
    model: GENERATION_MODEL,
    skill_name: GENERATE_SKILL,
    skill_sha: generateSha,
    call_mode: "generate",
    response_validated_against: "Generation",
  });
  const generateHandle = session.skill(GENERATE_SKILL, {
    model: GENERATION_MODEL,
    args: {
      capability_id: ctx.payload.capability_id,
      previous_index_path: ctx.payload.previous_index_path,
      previous_detail_path: ctx.payload.previous_detail_path,
      diff_path: ctx.payload.diff_path,
      schema_index_path: "schemas/context-index.schema.json",
      schema_detail_path: "schemas/context-detail.schema.json",
    },
    result: Generation,
    tools: [],
  });
  const { data: generated } = await generateHandle;

  return {
    mode: "generated" as const,
    assessment,
    generated,
  };
}
