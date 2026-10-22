# Waiting for ECS services to deploy

A release used to go green as soon as `terraform apply` had asked ECS to deploy, even if the new containers never started. From `v8.0.0-ecs` of the `ecs` module in [i-dot-ai-core-terraform-modules](https://github.com/i-dot-ai/i-dot-ai-core-terraform-modules), the apply itself waits for every ECS service in the root module to roll out its new version healthily, and fails if one does not.

Nothing in this repository needs configuring for that. It happens inside Terraform, so it works for every app that bumps the module, however many services it has and whatever they are called.

## What happens on a bump

With `v8.0.0-ecs` or later, for each ECS service the apply:

- waits for the new deployment to complete, which takes about 1–2 minutes with the default health check timings
- fails if the deployment fails or is rolled back by the ECS circuit breaker, which is now on by default, so a bad image never replaces the running version
- gives up after `wait_timeout` (default 5 minutes) if the deployment has not completed

Slow-starting services, for example ones that download a model on start, should raise `health_check_grace_period_seconds` and `wait_timeout` on their module. See the module's README for every setting.

Services without a load balancer, such as backends behind service discovery and workers, are only checked if they set `container_healthcheck`. Apps generated from `i-dot-ai-cookiecutter` set it for the backend.

## Migrating from `ENABLE_HEALTHCHECK`

`ENABLE_HEALTHCHECK` is deprecated. It only works for apps with a single ECS service whose name matches `i-dot-ai-<env>-<APP_NAME>-ecs-service` in the shared `i-dot-ai-<env>-ecs-cluster`, and it cannot detect rollbacks.

Bump the `ecs` module to `v8.0.0-ecs` or later, then remove `ENABLE_HEALTHCHECK: true` from your workflow. If you leave the flag set, the old check still runs after the apply and shows a deprecation warning.
