const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { getConfig } = require('./config');
const { authenticateRequest } = require('./utils/authSession');
const { createServer } = require('http');
const { Server: SocketServer } = require('socket.io');
const Conversation = require('./models/Conversation');
const Session = require('./models/Session');
const chatEvents = require('./utils/chatEvents');

async function startServer() {
  // False positive: the API uses no cookies or sessions, so it has no ambient credentials for CSRF to abuse.
  // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
  const app = express();
  const { mongoUri, port } = getConfig();

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas');

  const server = new ApolloServer({ typeDefs, resolvers });
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

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`GraphQL server running at http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
