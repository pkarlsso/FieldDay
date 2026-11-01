// The root test scripts import Apollo Server through this file. npm installs
// @apollo/server under backend/node_modules rather than the root (its helper
// packages clash with the frontend's @apollo/client), and Node only finds a
// package in a node_modules folder above the importing file.
export { ApolloServer } from '@apollo/server';
