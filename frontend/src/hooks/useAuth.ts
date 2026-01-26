import type { AppDispatch, RootState } from "@/store";
import { login, logout, register } from "@/store/authSlice";
import { useDispatch, useSelector } from "react-redux";

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const isLoading = useSelector((s: RootState) => s.auth.isLoading);
  const error = useSelector((s: RootState) => s.auth.error);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login: (email: string, password?: string) =>
      dispatch(login({ email, password })).unwrap(),
    register: (email: string, name: string, password?: string) =>
      dispatch(register({ email, name, password })).unwrap(),
    logout: () => dispatch(logout()),
  };
}
