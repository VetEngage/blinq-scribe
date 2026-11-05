import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient, type Client } from "graphql-ws";
import { authHeader } from "./session";

// GraphQL at /graphql: queries and mutations over HTTP, subscriptions over graphql-ws. The bearer token
// goes in the Authorization header (HTTP) and in the connection's init payload (websocket), never a URL.

const httpLink = new HttpLink({ uri: "/graphql" });
const withAuth = setContext((_, { headers }) => ({ headers: { ...headers, ...authHeader() } }));

let ws: Client | null = null;
function wsClient(): Client {
  if (!ws) {
    const url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/graphql`;
    ws = createClient({ url, lazy: true, connectionParams: () => authHeader() });
  }
  return ws;
}

// The socket opens on the first subscription and is rebuilt after a sign out, with the new token.
const lazyWs: Client = {
  subscribe: (payload, sink) => wsClient().subscribe(payload, sink),
  iterate: (payload) => wsClient().iterate(payload),
  on: (event, listener) => wsClient().on(event, listener),
  dispose: () => ws?.dispose(),
  terminate: () => ws?.terminate(),
};

const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === "OperationDefinition" && def.operation === "subscription";
  },
  new GraphQLWsLink(lazyWs),
  withAuth.concat(httpLink),
);

export const apollo = new ApolloClient({
  link,
  // No __typename in answers: the console sends some of them straight back as inputs (the note).
  cache: new InMemoryCache({ addTypename: false }),
  defaultOptions: {
    query: { fetchPolicy: "no-cache", errorPolicy: "none" },
    mutate: { fetchPolicy: "no-cache", errorPolicy: "none" },
  },
});

/** Signing out: close the socket (it carried the old token) and drop anything cached. */
export function resetApollo(): void {
  if (ws) {
    void ws.dispose();
    ws = null;
  }
  void apollo.clearStore();
}
