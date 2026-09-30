// Flue runtime entry point for the generate-context agent.
// Authored under SLICE-006a of EXEC-20260515-platform-context-management.
// Locked: this file is part of the SLICE-006a target_files set; behavioural
// changes require a contract dispute against this slice.
//
// Provider configuration: anthropic provider name routed at the i.AI LLM
// Gateway. Both LLM_GATEWAY_URL and CONTEXT_GENERATION_LLM_KEY are read
// from environment variables only — no literal URLs and no literal keys
// appear in this source.
//
// Type note: Flue's Fetchable interface accepts `unknown` for env and ctx.
// We narrow to a typed FlueEnv inside the handler with a runtime guard so
// missing env vars produce a clear startup error rather than a runtime
// auth failure deeper in the agent.

import { configureProvider, flue } from "@flue/runtime/app";

interface FlueEnv {
  LLM_GATEWAY_URL: string;
  CONTEXT_GENERATION_LLM_KEY: string;
}

function assertFlueEnv(env: unknown): asserts env is FlueEnv {
  if (typeof env !== "object" || env === null) {
    throw new Error(
      "Flue env is not an object; cannot read LLM_GATEWAY_URL or CONTEXT_GENERATION_LLM_KEY.",
    );
  }
  const e = env as Partial<FlueEnv>;
  if (typeof e.LLM_GATEWAY_URL !== "string" || e.LLM_GATEWAY_URL.length === 0) {
    throw new Error("LLM_GATEWAY_URL env var is required for the generate-context agent.");
  }
  if (
    typeof e.CONTEXT_GENERATION_LLM_KEY !== "string" ||
    e.CONTEXT_GENERATION_LLM_KEY.length === 0
  ) {
    throw new Error(
      "CONTEXT_GENERATION_LLM_KEY env var is required for the generate-context agent.",
    );
  }
}

export default {
  fetch(req: Request, env: unknown, ctx: unknown): Response | Promise<Response> {
    assertFlueEnv(env);
    configureProvider("anthropic", {
      baseUrl: env.LLM_GATEWAY_URL,
      apiKey: env.CONTEXT_GENERATION_LLM_KEY,
    });
    // Hono's fetch types ctx as ExecutionContext | undefined (Cloudflare
    // Workers shape). On Node the runtime ignores ctx (per Flue docs) so
    // we forward the unknown value through a typed-cast to satisfy the
    // Hono signature without pulling in @cloudflare/workers-types as a
    // build-time dependency.
    return flue().fetch(req, env, ctx as Parameters<ReturnType<typeof flue>["fetch"]>[2]);
  },
};
