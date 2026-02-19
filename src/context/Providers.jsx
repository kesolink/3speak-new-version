// import { AuthProvider } from "./AuthContext";
import { useAppStore } from "../lib/store";
import { LegacyUploadProvider } from "./LegacyUploadContext";
// import { ThemeProvider } from "./ThemeContext";

export const AppProviders = ({ children }) => {
    const { user } = useAppStore();
  return (
    // <AuthProvider>
      <LegacyUploadProvider key={user}>
        {/* <ThemeProvider> */}
          {children}
        {/* </ThemeProvider> */}
      </LegacyUploadProvider>
    // </AuthProvider>
  );
};
