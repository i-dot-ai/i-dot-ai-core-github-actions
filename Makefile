# Makefile — i-dot-ai-core-github-actions
#
# Targets are wired to run inside the EXEC-20260515-platform-context-management
# validation container (--network=none). They also work on a developer host
# that has python3 + pyyaml + jsonschema + pytest available locally.
#
# Authored under SLICE-001.

PYTHON ?= python3
SCRIPTS_DIR := scripts
SCHEMA_DIR := schemas
FIXTURES_DIR := $(SCRIPTS_DIR)/fixtures

.PHONY: help validate validate-fixtures schema-test pytest

help:
	@echo "Targets:"
	@echo "  make validate           Validate the four shipped fixtures and run regex tests."
	@echo "  make validate-fixtures  Run validate_context.py against the four fixtures."
	@echo "  make schema-test        Metaschema-validate both schema files."
	@echo "  make pytest             Run pytest on scripts/tests."

validate: schema-test validate-fixtures pytest

schema-test:
	$(PYTHON) -c "import json; from jsonschema import Draft202012Validator; \
[Draft202012Validator.check_schema(json.load(open(p))) for p in [\
'$(SCHEMA_DIR)/context-index.schema.json', \
'$(SCHEMA_DIR)/context-detail.schema.json'] ]"
	@echo "schemas: OK (Draft 2020-12 metaschema)"

validate-fixtures:
	$(PYTHON) $(SCRIPTS_DIR)/validate_context.py --layer index $(FIXTURES_DIR)/context-index.valid.yaml
	@! $(PYTHON) $(SCRIPTS_DIR)/validate_context.py --layer index $(FIXTURES_DIR)/context-index.invalid.yaml 2>/dev/null
	$(PYTHON) $(SCRIPTS_DIR)/validate_context.py --layer detail $(FIXTURES_DIR)/context-detail.valid.yaml
	@! $(PYTHON) $(SCRIPTS_DIR)/validate_context.py --layer detail $(FIXTURES_DIR)/context-detail.invalid.yaml 2>/dev/null
	@echo "fixtures: OK (positives pass, negatives reject)"

pytest:
	$(PYTHON) -m pytest -q $(SCRIPTS_DIR)/tests
