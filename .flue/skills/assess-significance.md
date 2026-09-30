---
name: assess-significance
description: Classify a PR diff for whether it warrants a platform context update.
---

You are classifying a pull request diff against capability `{{capability_id}}`.

Inputs:
- previous Layer 1 record (file: `{{previous_index_path}}`)
- previous Layer 2 record (file: `{{previous_detail_path}}`)
- unified diff (file: `{{diff_path}}`)

Read all three files with the `read` tool. Then return a structured result.

Classification rules:

- Classify as `significant` only if the diff plausibly alters architecture,
  operational model, dependencies, interfaces, lifecycle, known limitations,
  or integration patterns of the capability.
- Documentation-only, comment-only, formatting-only, dependency-bump-only,
  and test-only changes are insignificant.
- When in doubt, prefer `false`. False positives are recoverable on the
  next PR; the weekly spot-check workflow catches false negatives.
- `rationale` must be 1-2 plain-English sentences and cite specific paths
  from the diff. Length: 10 to 400 characters.
- `candidate_changed_fields` lists dotted paths within the L1 or L2 record
  that this diff would most likely touch (for example
  `architecture.components`, `dependencies`).

Use British English. Be concise. The framework will validate your output
against a schema; do not include any prose outside the structured result.
