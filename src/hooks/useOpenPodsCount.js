import { useQuery } from '@tanstack/react-query';
import { HangoutsApiClient } from '@snapie/hangouts-core';

// listRooms() is a public read endpoint — no session token required, so this
// hook does NOT trigger any sign prompt. Used as a "live now" indicator on
// every Hangouts entry point (sidebar, top nav tab, bottom nav).
const HANGOUTS_API_URL = import.meta.env.VITE_HANGOUTS_API_URL || '';
const hangoutsClient = HANGOUTS_API_URL
  ? new HangoutsApiClient({ baseUrl: HANGOUTS_API_URL })
  : null;

export default function useOpenPodsCount() {
  const { data = [] } = useQuery({
    queryKey: ['openpods-live-rooms'],
    queryFn: () => hangoutsClient.listRooms(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!hangoutsClient,
  });
  return data.length;
}
