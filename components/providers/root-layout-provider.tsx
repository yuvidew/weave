"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { UserDetailContext } from "@/context/user-detail-context";
import type { User } from "@/db/schema";

/**
 * @component RoolLayoutProvider
 * @description Root-level provider that syncs the signed-in Clerk user into the DB on mount and exposes it via `UserDetailContext`.
 */
const RoolLayoutProvider = ({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) => {

    // Current user's DB row, fetched/created once the provider mounts.
    const [userDetail, setUserDetail] = useState<User>()

    useEffect(() => {

        // Ensures a DB row exists for the signed-in Clerk user, creating one on first sign-in.
        const createNewUser = async () => {
            const result = await axios.post("/api/users");

            setUserDetail(result.data)
        };

        createNewUser();

    }, [])

    return (
        <div>
            <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
                {children}
            </UserDetailContext.Provider>
        </div>
    );
};

export default RoolLayoutProvider;
