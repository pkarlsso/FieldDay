import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers.js';
import { getConfig } from './config.js';
import { authenticateRequest } from './utils/authSession.js';

async function startServer() {
  // False positive: the API uses no cookies or sessions, so it has no ambient credentials for CSRF to abuse.
  // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
  const app = express();
  const { mongoUri, port } = getConfig();

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas');

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use('/graphql', cors(), express.json(), expressMiddleware(server, {
    // Makes the signed-in user (from the "Authorization: Bearer <token>" header)
    // available to resolvers as context.currentUser.
    context: async ({ req }) => ({ currentUser: await authenticateRequest(req) })
  }));

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(port, '0.0.0.0', () => {
    console.log(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
