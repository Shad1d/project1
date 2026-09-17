import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { API_BASE_URL } from "../config/api.js";

// AuthContext stores login state so it survives page navigation.
// It reads/writes localStorage to keep the user logged in after refresh.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // `user` is the logged-in user object (or null if logged out).
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const persistUser = useCallback((nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  // Load saved auth state when the app starts.
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setIsHydrating(false);
      return;
    }

    // Validate the stored token against the server on every app load
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        // Token is valid — hydrate state with fresh user data from DB
        persistUser(data.user);
        setToken(savedToken);
      })
      .catch(() => {
        // Token expired, account deactivated, or network error — force logout
        persistUser(null);
        localStorage.removeItem("token");
      })
      .finally(() => {
        setIsHydrating(false);
      });
  }, [persistUser]);

  // Call this after a successful login.
  const login = useCallback(
    (userData, authToken) => {
      persistUser(userData);
      setToken(authToken);
      localStorage.setItem("token", authToken);
    },
    [persistUser],
  );

  // Call this to log out and clear all auth data.
  const logout = useCallback(() => {
    persistUser(null);
    setToken(null);
    localStorage.removeItem("token");
  }, [persistUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoggedIn: Boolean(user && token),
      isHydrating,
      login,
      logout,
      updateUser: persistUser,
    }),
    [user, token, isHydrating, login, logout, persistUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}