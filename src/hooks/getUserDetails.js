import { useQuery } from "@tanstack/react-query";
import { fetchHiveProfile } from "../lib/videoData";

// Logged-in user's profile — from Hive (lib/videoData), not the retired union
// GraphQL API. Returns the same `{ profile }` shape the old USER_DETAILS query did.
export function useGetMyQuery() {
  let user_id;
  if (typeof window !== "undefined") {
    user_id = window.localStorage.getItem("user_id");
  }

  const { data } = useQuery({
    queryKey: ["my-profile", user_id],
    queryFn: () => fetchHiveProfile(user_id),
    enabled: !!user_id,
    staleTime: 5 * 60 * 1000,
  });

  return data ? { profile: data } : undefined;
}
