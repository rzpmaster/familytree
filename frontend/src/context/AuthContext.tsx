/* eslint-disable react-refresh/only-export-components */
import { User } from '@/types';
import React, { createContext, useEffect, useState } from 'react';
import { getUser, loginUser, registerUser } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  register: (email: string, name: string, password?: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage on mount
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          
          // Refresh user data from backend to get latest roles
          try {
             const freshUser = await getUser(parsedUser.id);
             setUser(freshUser);
             localStorage.setItem('user', JSON.stringify(freshUser));
          } catch (err) {
             console.error("Failed to refresh user data", err);
             // If user not found (deleted?), logout
             // localStorage.removeItem('user');
             // setUser(null);
          }
        } // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch (_) {
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    const userData = await loginUser(email, password || 'password');
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (email: string, name: string, password?: string) => {
    await registerUser(email, name, password || 'password');
    // Auto login after register
    await login(email, password);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      register,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};


