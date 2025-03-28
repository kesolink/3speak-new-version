import axios from "axios";
import { LOCAL_STORAGE_ACCESS_TOKEN_KEY } from "./../localStorageKeys";

export const api = axios.create({
  baseURL: "https://staging.3speak.tv/api", // TODO use env var
  method: "POST",
});

export function setContentType(contentType) {
  api.defaults.headers["Content-Type"] = contentType;
}

export function setAuthorization(auth) {
  api.defaults.headers.Authorization = auth ? `Bearer ${auth}` : null;
}

setContentType("application/json");

if (typeof window !== "undefined") {
  // TODO SSR support
  setAuthorization(window.localStorage.getItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY));
}