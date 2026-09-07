# FieldDay Development Process

As we finish each 2 week cycle, we will hold a meeting where we go over the tasks that have been completed, see what needs to be rolled over into the next cycle and how our schedule needs to be re-arranged, if necessary. We will not require a full-team vote on closing issues, rather leaving it down to the PR creator and the reviewer to decide whether a certain implementation has solved a problem or step in our development. During this meeting, we will also update the roadmap to reflect the current state of development, as well as add in new parts to the future plan.

## Repository Architecture

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


## References for How To Structure Project

1. [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/) 
2. [Express: How should I structure my application?](https://expressjs.com/en/starter/faq/#how-should-i-structure-my-application)
3. [Node.js Best Practices: Layer your components](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/createlayers.md)

## Branching Model

For our project, we will primarily be using a model using a "Main" branch (containing the auto-deploy ready version of our project), "Dev" branch (containing the current functioning, but not necessarily deployable iteration) and then individual branches where specific work-in-progress code is being held before being merged into the "shared" branch.

## Pull Request Process