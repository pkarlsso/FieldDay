import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers.js';
import { getConfig } from './config.js';
import { authenticateRequest } from './utils/authSession.js';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import logger from './utils/logger.js';
import Conversation from './models/Conversation.js';
import Session from './models/Session.js';
import chatEvents from './utils/chatEvents.js';

async function startServer() {
  // False positive: the API uses no cookies or sessions, so it has no ambient credentials for CSRF to abuse.
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
  app.use('/graphql', cors(), express.json({ limit: '300kb' }), expressMiddleware(server, {
    // Makes the signed-in user (from the "Authorization: Bearer <token>" header)
    // available to resolvers as context.currentUser.
    context: async ({ req }) => ({ currentUser: await authenticateRequest(req) })
  }));

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, { cors: { origin: '*' } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const currentUser = await authenticateRequest({ headers: { authorization: `Bearer ${token || ''}` } });
      if (!currentUser) return next(new Error('You must be signed in to connect.'));
      socket.currentUser = currentUser;
      return next();
    } catch (error) {
      return next(error);
    }
  });
  io.on('connection', (socket) => {
    socket.on('joinConversation', async (conversationId, callback = () => {}) => {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return callback({ ok: false, error: 'Conversation not found' });
      let allowed = conversation.participants.some((id) => id.equals(socket.currentUser._id));
      if (!allowed && conversation.kind === 'session') {
        const session = await Session.findById(conversation.session);
        allowed = Boolean(session && conversation.participants.some((id) => id.equals(socket.currentUser._id)));
      }
      if (!allowed) return callback({ ok: false, error: 'You cannot access this conversation' });
      await socket.join(`conversation:${conversationId}`);
      return callback({ ok: true });
    });
  });
  chatEvents.on('message', (conversationId, message) => {
    io.to(`conversation:${conversationId}`).emit('message', message);
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
