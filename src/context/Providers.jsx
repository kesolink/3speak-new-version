// import { AuthProvider } from "./AuthContext";
// Upload providers (Embed/HiveAuth/Hangout/Chat) are mounted directly in App.jsx.
// The legacy and mobile studio flows were removed, so this wrapper is now a no-op
// passthrough kept for the existing import in main.jsx.
export const AppProviders = ({ children }) => {
  return <>{children}</>;
};
