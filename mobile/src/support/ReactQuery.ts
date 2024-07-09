import { QueryClient } from '@tanstack/react-query';

const MAX_RETRIES = 3;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Retry only when the thrown error opts-in
        return (
          failureCount < MAX_RETRIES &&
          error instanceof Error &&
          Object(error).shouldRetry === true
        );
      },
    },
  },
});
