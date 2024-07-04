import { QueryClient } from '@tanstack/react-query';

import { FetchError } from '../support/Fetch';

const MAX_RETRIES = 3;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on unexpected status error or content-type error
        if (error instanceof FetchError) {
          return false;
        }
        return failureCount < MAX_RETRIES;
      },
    },
  },
});
