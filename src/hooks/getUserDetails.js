import { useQuery } from "@apollo/client";
import { USER_DETAILS } from "../graphql/queries";


export function useGetMyQuery() {
  let user_id;
  if (typeof window !== "undefined") {
    user_id =
      window.localStorage.getItem("user_id") 
    //   ||localStorage.getItem("access_token");
  }
  const { data, loading, error } = useQuery(USER_DETAILS, {
    variables: { id: user_id },
    skip: !user_id,
  });

  return data;
}
