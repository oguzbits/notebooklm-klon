import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSession, signIn, signOut, signUp, startGuest } from '@/lib/auth';
import { queryKeys } from '@/lib/query-keys';

/** The signed-in user; `data` is null when nobody is signed in. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: getSession, staleTime: Infinity });
}

interface Credentials {
  email: string;
  password: string;
}

/** Sign in or sign up, then load everything again for the new session. */
export function useAuthenticate(mode: 'signIn' | 'signUp') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      (mode === 'signIn' ? signIn : signUp)(email, password),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

/**
 * The guest of the live demo. The result is the example notebook made for them. The session is
 * asked for again without waiting, so the page that started the guest still knows where to go
 * when the session shows up.
 */
export function useStartGuest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: startGuest,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    // Everything cached belongs to the user who just left. The session query stays (the layout
    // listens to it) and now says that nobody is signed in.
    onSuccess: () => {
      client.removeQueries({ queryKey: queryKeys.notebooks });
      client.setQueryData(queryKeys.session, null);
    },
  });
}
