// src/graphql/client.ts
import {
    ApolloClient,
    InMemoryCache,
    createHttpLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { API_BASE_URL } from '../config/env';
import { getAccessToken } from '../utils/secureStore';

// HTTP link to your Flask /graphql endpoint
const httpLink = createHttpLink({
    uri: `${API_BASE_URL}/graphql`,
});

// Attach JWT from secure storage to every request
const authLink = setContext(async (_, { headers }) => {
    const token = await getAccessToken();
    return {
        headers: {
            ...headers,
            Authorization: token ? `Bearer ${token}` : '',
        },
    };
});

export const apolloClient = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
});
