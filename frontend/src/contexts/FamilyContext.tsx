import { Family } from "@/types";
import { createContext, useContext } from "react";

export const FamilyContext = createContext<Family | null>(null);

export const useFamily = () => useContext(FamilyContext);
