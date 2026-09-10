import { db, users } from "@/db";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Looks up the signed-in Clerk user in the DB, creating a row for them on first sign-in.
export const POST = async (req: NextRequest) => {
    const user = await currentUser();

    // Check user exist in db 
    const users_result = await db.select().from(
        users
    ).where(eq(users.email, user?.primaryEmailAddress?.emailAddress??""));

    // in not then insert new user
    if(users_result.length == 0){
        const result = await db.insert(users).values({
            name: user?.fullName,
            email: user?.primaryEmailAddress?.emailAddress??"",
        }).returning();

        return NextResponse.json(result[0]);
    };

    return NextResponse.json(users_result[0]);
}