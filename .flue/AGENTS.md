# generate-context agent invariants

This document defines the invariants the generate-context Flue agent
MUST observe at every invocation. Authored under SLICE-006b of
EXEC-20260515-platform-context-management. Locked: any change requires
a contract dispute against this slice.

## Invariants

1. **Refuse to run on a pull request from a fork.** The check is
   enforced by the calling workflow (SLICE-006c-a) before the agent
   is invoked, because GitHub Actions OIDC and write tokens are not
   available on fork PRs and the LiteLLM key would be exposed.

2. **Use temperature 0** (or the lowest value the gateway permits).
   Both significance assessment and generation calls run at temperature
   0. The model is asked to return structured outputs, not creative
   prose; determinism is a feature.

3. **Read-only tool restriction.** The agent declares `tools: []` at
   `init()` and at every `skill()` call. The Flue sandbox is the
   `local()` Node sandbox configured to expose only the env vars listed
   in `.flue/agents/generate-context.ts`. The agent MUST NOT call
   `bash`, `gh`, `git`, or any filesystem-mutating tool. The calling
   workflow performs all side effects (file writes, validator
   invocation, git commit, PR annotation, metric emission).

4. **Record model identifier and skill SHA256 per call.** The agent
   emits one structured JSON line on stdout per skill invocation:
   `{model, skill_name, skill_sha, call_mode, response_validated_against}`.
   The calling workflow captures these into the PR annotation so
   reviewers can trace generated content to a specific skill version.

5. **Never echo `CONTEXT_GENERATION_LLM_KEY` or `GH_TOKEN`.** The
   agent does not log env var values at any level. `local()` sandbox
   passes the keys to the provider and to the harness only; they do
   not appear in skill arguments, prompts, or stdout.

6. **Field-forcing is the workflow's responsibility, not the agent's.**
   The agent's output for `context_index` and `context_detail` is
   POST-PROCESSED by the calling workflow before any file is written.
   The workflow forces `capability_id`, `schema_version`,
   `last_updated`, and `updated_by` from workflow inputs, regardless
   of what the agent produced. The agent and the skill prompts
   instruct the model to leave these alone for clarity, but the
   workflow does not rely on the model honouring that.

7. **Validation retry: at most one retry.** The calling workflow runs
   the SLICE-001 validator against the agent's field-forced output.
   On failure, the workflow re-invokes the agent with the validation
   error appended to the payload. No third retry. The skill prompt
   for `generate-context` instructs the model to fix only the reported
   field on the second pass.

## Why these invariants

The read-only tool restriction is the model-assurance affordance: the
LLM cannot wander into shell or filesystem writes; only the workflow
can mutate the branch or call the validator. Field forcing is the
data-quality affordance: even a perfectly-prompted LLM is not trusted
to set the four identity fields, because attacker-controlled input
records may try to subvert them.

These invariants align with the RFC's security and assurance posture.
Changes to any of them require a contract dispute against SLICE-006b
and a re-measurement of the spot-check quality gate from SLICE-007.
