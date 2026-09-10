"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { User } from "@/db/schema";

type UserDetailContextType = {
  userDetail: User | undefined;
  setUserDetail: Dispatch<SetStateAction<User | undefined>>;
};

// Holds the signed-in user's DB row app-wide; populated by `RoolLayoutProvider`.
export const UserDetailContext = createContext<UserDetailContextType | null>(null);

// Reads `UserDetailContext`, throwing if used outside of `RoolLayoutProvider`.
export const useUserDetail = () => {
  const context = useContext(UserDetailContext);
  if (!context) {
    throw new Error("useUserDetail must be used within a RoolLayoutProvider.");
  }

  return context;
}
