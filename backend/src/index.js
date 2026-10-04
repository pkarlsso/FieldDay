import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers.js';
import { getConfig } from './config.js';
import { authenticateRequest } from './utils/authSession.js';
import logger from './utils/logger.js';

function csrfProtection(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const configuredOrigins = (process.env.CSRF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (origin !== requestOrigin && !configuredOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Cross-origin request blocked' });
  }
  return next();
}

async function startServer() {
  // CSRF protection is applied to browser requests on the GraphQL route below.
  // Native requests use bearer headers rather than ambient cookies or sessions.
  // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
  const app = express();
  const { mongoUri, port } = getConfig();

  await mongoose.connect(mongoUri);
  logger.info('Connected to MongoDB Atlas');

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [{
      async requestDidStart() {
        return {
          async didEncounterErrors({ operationName, errors }) {
            logger.error('GraphQL request encountered errors', {
              operationName,
              errors: errors.map((error) => ({ message: error.message, path: error.path }))
            });
          }
        };
      }
    }]
  });
  await server.start();

  // Raised from the 100kb default so profile pictures (up to ~200k chars) fit.
  app.use('/graphql', csrfProtection, cors(), express.json({ limit: '300kb' }), expressMiddleware(server, {
    // Makes the signed-in user (from the "Authorization: Bearer <token>" header)
    // available to resolvers as context.currentUser.
    context: async ({ req }) => ({ currentUser: await authenticateRequest(req) })
  }));

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(port, '0.0.0.0', () => {
    logger.info(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
