# FieldDay Development Process

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
```

## References for How To Structure Project

1. [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/) 
2. [Express: How should I structure my application?](https://expressjs.com/en/starter/faq/#how-should-i-structure-my-application)
3. [Node.js Best Practices: Layer your components](https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/createlayers.md)

