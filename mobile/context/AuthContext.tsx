import { createContext, useState, useEffect, ReactNode } from "react";
import { login as apiLogin, register as apiRegister } from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
    await AsyncStorage.setItem("user", JSON.stringify(res.user));
  };

  const register = async (email: string, password: string) => {
    const res = await apiRegister(email, password);
    setUser(res.user);
    await AsyncStorage.setItem("user", JSON.stringify(res.user));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}