const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { getConfig } = require('./config');

async function startServer() {
  // False positive: the API uses no cookies or sessions, so it has no ambient credentials for CSRF to abuse.
  // nosemgrep: javascript.express.security.audit.express-check-csrf-middleware-usage.express-check-csrf-middleware-usage
  const app = express();
  const { mongoUri, port } = getConfig();

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas');

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use('/graphql', cors(), express.json(), expressMiddleware(server));

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(port, '0.0.0.0', () => {
    console.log(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
