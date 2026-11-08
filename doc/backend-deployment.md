# Backend deployment

Every push to `main` starts the GitHub Actions Release / Backend Deployment
workflow. It packages the backend from that commit, assumes the AWS deployment
role through GitHub OIDC, uploads a versioned bundle to S3, deploys it to the
Elastic Beanstalk environment, and checks the public API health endpoint. A
manual run can also be started from the Actions tab. Runs share a concurrency
group to avoid overlapping deployments; GitHub may replace a pending run with
a newer pending run. Even frontend-only or documentation commits start a
backend deployment, so each run uses AWS resources and may incur charges.

For a failed release, inspect the GitHub Actions run and Elastic Beanstalk
events and logs. Roll back by reverting the bad commit and merging the revert
to main, or by selecting an earlier known-good application version in Elastic
Beanstalk. Preserve environment configuration and secrets when rolling back.
The health endpoint is a basic availability check; it does not prove that
email, Gorse, or every feature is working.

The existing Gorse SSH tunnel is configured on the AWS host outside this
workflow. This workflow does not recreate it if the instance is replaced;
automatic recovery is tracked in #384 and needs a separate verified solution.
