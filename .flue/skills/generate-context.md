---
name: generate-context
description: Produce updated Layer 1 and Layer 2 records that reflect a PR diff.
---

You are updating the platform context records for capability `{{capability_id}}`.

Inputs:
- previous Layer 1 record (file: `{{previous_index_path}}`)
- previous Layer 2 record (file: `{{previous_detail_path}}`)
- Layer 1 JSON Schema (file: `{{schema_index_path}}`)
- Layer 2 JSON Schema (file: `{{schema_detail_path}}`)
- unified diff (file: `{{diff_path}}`)

Read all five files with the `read` tool before producing output.

Operating rules:

1. Be evidence-bound. Every changed value must trace to a line in the
   diff or a value already present in the previous record. Do not
   invent dependencies, components, or interfaces.
2. Honour the schemas absolutely. Use only fields the schemas permit,
   and only enum values the schemas allow.
3. Do not set `capability_id`, `schema_version`, `last_updated`, or
   `updated_by`. The calling workflow will overwrite these. Carry the
   previous values through verbatim. Do not invent values.
4. Preserve fields the diff does not justify changing. Verbatim is
   preferred to paraphrase.
5. Use British English in all narrative fields. Plain, neutral language.
   No bold, no bullet markers inside string values.

The framework will validate your structured response against the schemas.
If validation fails, you will be re-invoked with the validation error
appended to your input. Fix only the reported field on the second pass.
