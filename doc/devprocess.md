# FieldDay Development Process

As we finish each 2 week cycle, we will hold a meeting where we go over the tasks that have been completed, see what needs to be rolled over into the next cycle and how our schedule needs to be re-arranged, if necessary. We will not require a full-team vote on closing issues, rather leaving it down to the PR creator and the reviewer to decide whether a certain implementation has solved a problem or step in our development. During this meeting, we will also update the roadmap to reflect the current state of development, as well as add in new parts to the future plan.

## Repository Architecture

```text
FieldDay/
├── .github/
│   └── workflows/
│       └── dev-to-main-enforcer.yml
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── seed.js
│       ├── graphql/
│       │   ├── typeDefs.js
│       │   └── resolvers.js
│       └── models/
│           ├── User.js
│           └── Session.js
├── frontend/
│   ├── .gitignore
│   ├── package.json
│   ├── app.json
│   ├── index.js
│   ├── App.js
│   └── src/
│       ├── api.js
│       ├── config.js
│       ├── graphql/
│       │   └── queries.js
│       └── screens/
│           ├── HomeScreen.js
│           ├── ProfileScreen.js
│           ├── RateSessionScreen.js
│           └── SessionCompleteScreen.js
└── doc/
    ├── devprocess.md
    ├── Final SDP - Team 4.md
    ├── Final SDP - Team 4.pdf
    ├── Design Document - Team 4.pdf
    ├── UpdatedVerification&VerificationPlan.pdf
    └── blank.txt
```


## References for How To Structure Project

1. [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/) 
2. [Express: How should I structure my application?](https://expressjs.com/en/starter/faq/#how-should-i-structure-my-application)
3. [Node.js Best Practices: Layer your components](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/createlayers.md)

## Branching Model

For our project, we will primarily be using a model using a "Main" branch (containing the auto-deploy ready version of our project), "Dev" branch (containing the current functioning, but not necessarily deployable iteration) and then individual branches where specific work-in-progress code is being held before being merged into the "shared" branch.

## Pull Request Process

### Naming and issue references

Every PR must reference at least one existing GitHub issue describing the problem, expected behavior, and acceptance criteria. Create the issue before opening the PR, and reuse existing issues for work already tracked. Keep each PR focused enough for a teammate to review and test.

Use `<type>: <short description>` for PR titles. Types are `feat` (new functionality), `fix` (bug fixes), `docs` (documentation), `test` (tests), `ci` (automation), `refactor` (internal restructuring), and `chore` (maintenance). For example: `feat: add session creation mutation`.

Use lowercase branch names with a type and short hyphenated description, such as `feat/session-creation` or `docs/pr-process`. Include the issue number when helpful, for example `feat/24-session-creation`.

Every PR description must summarize the change, reference its issue with `Refs #<number>`, and record local validation commands or manual steps and their results. For example, a feature PR targeting `dev` could contain:

```markdown
Title: feat: add session creation mutation
Base: dev

Refs #24

Adds session creation with input validation and automatically includes the host
in the participant roster.

Local validation:
- [Replace with the commands or manual steps actually performed and their results.]
```

`Refs #24` creates a clickable reference and records the relationship in the issue's activity. Use the Development sidebar to attach the issue where available. A reference does not itself close the issue.

### Local validation and code review

- Test every PR locally before pushing it. After further changes, rerun the checks affected by those changes before pushing an update.
- For application changes, run the relevant available tests and exercise the changed behavior locally. Include invalid inputs and failure cases where applicable. For documentation, preview the Markdown, check links and formatting, and run `git diff --check`.
- List the exact commands or manual checks and outcomes in the PR. If a required check fails or cannot run, explain why and keep the PR in draft until it is ready for approval. Never report an unrun check as passed.
- Request approval from at least one teammate who did not author the PR. The reviewer checks the linked issue's acceptance criteria, implementation, validation evidence, and effects on existing behavior. Run additional local checks when needed to verify the change.
- Resolve requested changes and review discussions before merging. If code changes after approval, request another review of the updated changes. The author must not approve their own PR.

### Merging and closing issues

1. Open feature, fix, documentation, and test PRs into `dev`. Merge only after local validation, any configured CI checks, and at least one non-author approval pass. An approved author or teammate with write access may perform the merge.
2. The author and reviewer decide whether the linked issue's acceptance criteria are satisfied, consistent with the two-week review process above. After the PR merges into `dev`, manually close a completed issue and reference the merged PR in the closing comment. Keep partially completed issues open and identify the remaining work.
3. Open a separate PR from `dev` into `main` when the integrated changes are tested and ready. List the included feature PRs and issues, record integration checks, and obtain at least one non-author approval. Use a merge commit for transfers between these long-lived branches to preserve shared history. Do not push directly to `main` or `dev`.
4. GitHub interprets `Closes #24` in a PR description only when that PR targets the default branch, currently `main`. It does not automatically close issues for a PR targeting `dev`. If an issue stays open until release, put `Closes #24` in the `dev` → `main` PR; merging that PR closes it automatically. Only use closing keywords for fully completed issues.
5. Delete short-lived feature branches after merging. Keep `main` and `dev`. If automatic branch deletion is enabled, protect both permanent branches from deletion. Sync `main` back into `dev` through a reviewed PR when needed.

These are team review and merge rules. An owner or repository admin must configure required approvals, required status checks, and branch rules to enforce them in GitHub. The existing source-branch workflow checks that PRs into `main` come from `dev`; it is not a substitute for tests or required review settings.

Reference: [GitHub — Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue).