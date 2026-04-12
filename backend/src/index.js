const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 4000;

async function startServer() {
  const app = express();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use('/graphql', cors(), express.json(), expressMiddleware(server));

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GraphQL server running at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
