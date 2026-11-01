import http from 'node:http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers.js';
import { getConfig } from './config.js';
import { authenticateRequest, demoAuthBypassEnabled } from './utils/authSession.js';
import logger from './utils/logger.js';
import { attachRealtime, startSessionClock } from './realtime.js';
import Conversation from './models/Conversation.js';
import Session from './models/Session.js';
import chatEvents from './utils/chatEvents.js';

// Requests without an Origin header (native apps, curl) are allowed; browser
// requests must come from this server or an origin in CSRF_ALLOWED_ORIGINS.
function isAllowedOrigin(origin, requestOrigin) {
  if (!origin) return true;
  const configuredOrigins = (process.env.CSRF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return origin === requestOrigin || configuredOrigins.includes(origin);
}

function csrfProtection(req, res, next) {
  if (!isAllowedOrigin(req.get('origin'), `${req.protocol}://${req.get('host')}`)) {
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
  if (demoAuthBypassEnabled()) {
    logger.warn('AUTH_DEMO_BYPASS is on: sign up and login skip the emailed 2FA code. Turn it off for real users.');
  }

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

  // Socket.IO shares the HTTP server so live session updates and chat use the
  // same host and port as GraphQL (path /socket.io).
  const httpServer = http.createServer(app);
  const io = attachRealtime(httpServer, {
    allowOrigin: (origin, req) => isAllowedOrigin(origin, `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`)
  });
  startSessionClock();

  // Session updates go to every connection (they carry only a session id), so
  // signing in is optional here; joining a chat checks for a signed-in user.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) socket.currentUser = await authenticateRequest({ headers: { authorization: `Bearer ${token}` } });
      return next();
    } catch (error) {
      return next(error);
    }
  });
  io.on('connection', (socket) => {
    socket.on('joinConversation', async (conversationId, callback = () => {}) => {
      if (!socket.currentUser) return callback({ ok: false, error: 'You must be signed in to join a conversation.' });
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return callback({ ok: false, error: 'Conversation not found' });
        let allowed = conversation.participants.some((id) => id.equals(socket.currentUser._id));
        if (conversation.kind === 'session') {
          const session = await Session.findById(conversation.session).select('participants');
          allowed = Boolean(session?.participants.some((id) => id.equals(socket.currentUser._id)));
        }
        if (!allowed) return callback({ ok: false, error: 'You cannot access this conversation' });
        await socket.join(`conversation:${conversationId}`);
        return callback({ ok: true });
      } catch (error) {
        return callback({ ok: false, error: error.name === 'CastError' ? 'Conversation not found' : 'Unable to join conversation' });
      }
    });
  });
  chatEvents.on('message', (conversationId, message) => {
    io.to(`conversation:${conversationId}`).emit('message', message);
  });

  httpServer.listen(port, '0.0.0.0', () => {
    logger.info(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
