import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: import.meta.env.VITE_GRAPHQL_API_URL, // Ensure this environment variable is set correctly
  cache: new InMemoryCache(),
});

export default client;


// import { ApolloClient, InMemoryCache } from "@apollo/client";

// const client = new ApolloClient({
//   uri: process.env.REACT_APP_GRAPHQL_API_URL, // Use REACT_APP_ prefix
//   cache: new InMemoryCache(),
// });

// export default client;
