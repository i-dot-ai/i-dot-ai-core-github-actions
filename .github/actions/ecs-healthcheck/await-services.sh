#!/usr/bin/env bash
# Waits for each ECS service in $SERVICES to finish rolling out its newest deployment, then checks
# it stays healthy for a short window. All services are checked together on every poll.
#
# Each service fails if ECS reports a failed deployment or a rollback since $APPLY_STARTED_AT, if its
# deployment is replaced, if it does not complete within timeout_seconds of this step starting, or
# if tasks stop during its stability window.
#
# $SERVICES is a JSON list: [{"cluster": "...", "service": "...", "timeout_seconds": 600, "stable_seconds": 60}]
set -euo pipefail
# A failed AWS call inside $(...) must stop the script, not read as "no crashes" or "no rollback"
shopt -s inherit_errexit

: "${SERVICES:?SERVICES must be a JSON list of services to wait on}"
POLL_SECONDS=${POLL_SECONDS:-15}
DEFAULT_TIMEOUT_SECONDS=600
DEFAULT_STABLE_SECONDS=60
START=$(date +%s)
APPLY_STARTED_AT=${APPLY_STARTED_AT:-$START}

# The CLI prints timestamps such as 2026-10-06T23:19:42.234000+01:00, in the runner's time zone,
# so convert them to Unix time before comparing
# shellcheck disable=SC2016 # jq code, not shell expansions
JQ_EPOCH='def epoch: capture("^(?<base>[0-9-]+T[0-9:]+)(\\.[0-9]+)?(?<tz>Z|[+-][0-9]{2}:[0-9]{2})$") as $t
  | ($t.base + "Z" | fromdateiso8601)
    - (if $t.tz == "Z" then 0
       else (if $t.tz[0:1] == "-" then -1 else 1 end) * (($t.tz[1:3] | tonumber) * 3600 + ($t.tz[4:6] | tonumber) * 60) end);'

# Per-service state, indexed by position in $SERVICES.
# PHASE moves from rolling-out to stabilising, then ends at healthy or failed.
CLUSTER=() SERVICE=() TIMEOUT=() STABLE=() PHASE=() DEPLOYMENT=() STABLE_SINCE=() STOPPED_AT_ROLLOUT=() RESULT=()

describe() {
  aws ecs describe-services --cluster "${CLUSTER[$1]}" --services "${SERVICE[$1]}" --output json --query 'services[0]'
}

# Reasons for this service's tasks that have stopped since its new deployment started, excluding scale-in
stopped_tasks() {
  local arns
  arns=$(aws ecs list-tasks --cluster "${CLUSTER[$1]}" --started-by "${DEPLOYMENT[$1]}" --desired-status STOPPED \
    --query 'taskArns[:100]' --output text)
  [[ -z "$arns" || "$arns" == "None" ]] && return 0
  # shellcheck disable=SC2086 # split the tab-separated ARNs into arguments
  aws ecs describe-tasks --cluster "${CLUSTER[$1]}" --tasks $arns --output json \
    | jq -r '.tasks[] | .stoppedReason // "no reason given" | select(startswith("Scaling activity") | not)'
}

# The first event since the apply started saying a deployment failed or was rolled back, if any.
# A rollback reactivates the previous deployment under its old ID, so after a fast rollback only the
# events show that the new deployment failed.
# This relies on ECS's event wording, so it would silently stop detecting rollbacks if AWS reworded
# these messages. Once the runner's AWS CLI is 2.18.18 or later, use the deployment history API
# (aws ecs list-service-deployments) instead: it reports each deployment's outcome, such as
# ROLLBACK_SUCCESSFUL, as a status field rather than as free text.
failure_event() {
  describe "$1" | jq -r --argjson since "$APPLY_STARTED_AT" "$JQ_EPOCH"'
    [.events[] | select((.createdAt | epoch) >= $since)
      | select(.message | test("\\) deployment failed: |\\) rolling back to deployment "))]
    | sort_by((.message | test("deployment failed") | not), (.createdAt | epoch)) | first | .message // empty'
}

fail() {
  PHASE[$1]=failed
  RESULT[$1]=$2
  echo "::error title=ECS service did not roll out::${SERVICE[$1]}: $2"
  echo "Recent events for ${SERVICE[$1]}:"
  describe "$1" | jq -r '.events[:5][] | "  \(.createdAt) \(.message)"'
}

check_rollout() {
  local i=$1 now=$2 event state
  event=$(failure_event "$i")
  if [[ -n "$event" ]]; then
    fail "$i" "ECS reported: ${event#*) }"
    return
  fi
  state=$(describe "$i" | jq -r --arg id "${DEPLOYMENT[i]}" \
    '(.deployments[] | select(.id == $id) | .rolloutState) // "REPLACED"')
  case "$state" in
    COMPLETED)
      echo "${SERVICE[i]} rolled out; checking it stays healthy for ${STABLE[i]}s..."
      PHASE[i]=stabilising
      STABLE_SINCE[i]=$now
      STOPPED_AT_ROLLOUT[i]=$(stopped_tasks "$i" | wc -l)
      ;;
    REPLACED) fail "$i" "deployment was replaced before completing" ;;
    *) if (( now >= START + TIMEOUT[i] )); then fail "$i" "did not finish rolling out within ${TIMEOUT[i]}s"; fi ;;
  esac
}

# Catches containers that start, pass, and then crash shortly afterwards
check_stability() {
  local i=$1 now=$2 event stops
  event=$(failure_event "$i")
  stops=$(stopped_tasks "$i")
  if [[ -n "$event" ]]; then
    fail "$i" "ECS reported: ${event#*) }"
  elif (( $(grep -c . <<< "$stops" || true) > STOPPED_AT_ROLLOUT[i] )); then
    fail "$i" "tasks stopped after rollout: $(sort -u <<< "$stops" | paste -sd ';' -)"
  elif (( now >= STABLE_SINCE[i] + STABLE[i] )); then
    PHASE[i]=healthy
    RESULT[i]="healthy"
    echo "${SERVICE[i]} is healthy"
  fi
}

# Load the services and find the deployment this apply created for each (the newest one)
while read -r entry; do
  i=${#SERVICE[@]}
  CLUSTER[i]=$(jq -r '.cluster' <<< "$entry")
  SERVICE[i]=$(jq -r '.service' <<< "$entry")
  TIMEOUT[i]=$(jq -r --argjson d "$DEFAULT_TIMEOUT_SECONDS" '.timeout_seconds // $d' <<< "$entry")
  STABLE[i]=$(jq -r --argjson d "$DEFAULT_STABLE_SECONDS" '.stable_seconds // $d' <<< "$entry")
  description=$(describe "$i")
  if [[ "$description" == "null" ]]; then
    PHASE[i]=failed
    RESULT[i]="not found in cluster ${CLUSTER[i]}"
    echo "::error title=ECS service not found::${SERVICE[i]} not found in cluster ${CLUSTER[i]}"
    continue
  fi
  PHASE[i]=rolling-out
  DEPLOYMENT[i]=$(jq -r "$JQ_EPOCH"' .deployments | sort_by(.createdAt | epoch) | last | .id' <<< "$description")
  echo "Waiting for ${SERVICE[i]} (${DEPLOYMENT[i]}), timeout ${TIMEOUT[i]}s, stability window ${STABLE[i]}s"
done < <(jq -c '.[]' <<< "$SERVICES")

while true; do
  now=$(date +%s)
  pending=0
  for i in "${!SERVICE[@]}"; do
    case "${PHASE[i]}" in
      rolling-out) check_rollout "$i" "$now" ;;
      stabilising) check_stability "$i" "$now" ;;
    esac
    case "${PHASE[i]}" in rolling-out|stabilising) pending=$((pending + 1)) ;; esac
  done
  (( pending == 0 )) && break
  sleep "$POLL_SECONDS"
done

echo
echo "Summary after $(( $(date +%s) - START ))s:"
FAILED=0
for i in "${!SERVICE[@]}"; do
  echo "  ${SERVICE[i]}: ${RESULT[i]}"
  if [[ "${PHASE[i]}" == failed ]]; then FAILED=1; fi
done
exit "$FAILED"
