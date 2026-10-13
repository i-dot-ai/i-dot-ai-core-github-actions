# Await ECS Services

After `apply-terraform.yml` runs `terraform apply`, it can wait for your ECS services to finish rolling out their new version. The release then only goes green if every service is running the new version healthily.

Without this, the pipeline goes green as soon as Terraform has asked ECS to deploy, even if the new containers never start.

## What it checks

All listed services are checked together, every 15 seconds. A service fails if:

- ECS reports that a deployment failed or was rolled back after `terraform apply` started, for example because the circuit breaker tripped. This is read from the service's events, because a rollback reactivates the previous deployment and leaves no failed deployment to inspect
- its deployment is replaced before completing
- its deployment has not completed within `timeout_seconds` of the check starting
- any of its new tasks stop during the `stable_seconds` window after it completes, which catches containers that start and then crash

Tasks stopped by scaling in are ignored. On failure, the job shows an error annotation and the service's last 5 ECS events, and still checks the remaining services.

## Usage

Opt in by adding two things to your repository. No change to your release workflow is needed.

1. A Terraform output called `ecs_services_to_await`, in the root module that `apply-terraform.yml` applies, listing the services to wait on e.g.:

   ```hcl
   output "ecs_services_to_await" {
     value = [
       { cluster = module.ecs_cluster.ecs_cluster_name, service = module.frontend.ecs_service_name },
       { cluster = module.ecs_cluster.ecs_cluster_name, service = module.backend.ecs_service_name },
     ]
   }
   ```

   List every ECS service the root module deploys. The `ecs` module in `i-dot-ai-core-terraform-modules` provides `ecs_service_name`. `cluster` accepts either a cluster name or ARN.

2. A `tf_output` make target that prints a Terraform output as JSON, so the workflow can read the output without knowing where your Terraform lives:

   ```makefile
   .PHONY: tf_output
   tf_output:
   	terraform -chdir=./terraform/ output -json $(output)
   ```

   Point `-chdir` at the same folder your `tf_auto_apply` target uses.

Apps generated from `i-dot-ai-cookiecutter` include both.

If either is missing, or the output is an empty list, the check is skipped. If the `tf_output` target exists but reading the output fails for any other reason, such as a state or credentials error, or the output is not a list, the release fails, because it can no longer confirm your services started.

## Fields and defaults

| Field             | Default  | Notes                                                                                                                                                                                           |
|-------------------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `cluster`         | Required | Cluster name or ARN.                                                                                                                                                                            |
| `service`         | Required | ECS service name.                                                                                                                                                                               |
| `timeout_seconds` | `600`    | How long to wait for the rollout to complete, measured from when the check starts. You may wish to raise the value for slow-starting services, for example ones that download a model on start. |
| `stable_seconds`  | `60`     | How long the service must stay healthy after its rollout completes.                                                                                                                             |

To override a default for one service, set the field on that entry:

```hcl
{ cluster = module.ecs_cluster.ecs_cluster_name, service = module.worker.ecs_service_name, timeout_seconds = 1800 }
```

## What "healthy" means

The check relies on ECS's own view of health. A service with a load balancer health check or a container health check must pass it before its rollout completes. A service with neither counts as healthy as soon as its container is running, so give services without a load balancer, such as backends reached through service discovery and workers, a container health check if you want this check to catch a broken health endpoint.

## Migrating from `ENABLE_HEALTHCHECK`

`ENABLE_HEALTHCHECK` is deprecated. It only works for apps with a single ECS service whose name matches `i-dot-ai-<env>-<APP_NAME>-ecs-service` in the shared `i-dot-ai-<env>-ecs-cluster`, and it cannot detect rollbacks or crashes after rollout.

To migrate, add the output and make target above, listing your one service, then remove `ENABLE_HEALTHCHECK: true` from your workflow. If you leave the flag set, the new check is used whenever the output exists.
