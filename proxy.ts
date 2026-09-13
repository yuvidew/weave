import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isClerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Just wires up Clerk's request context (needed for `auth()` to work in
// server components/route handlers) — it does NOT gate any routes itself.
// `createRouteMatcher` + path-based protection here is Clerk's deprecated
// pattern for this version; actual protection lives per-layout/route
// instead (see app/(root)/layout.tsx and each API route's currentUser()
// check) so it can't drift out of sync with what Next.js actually routes.
export default isClerkConfigured
  ? clerkMiddleware()
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html|css|js|gif|svg|jpg|jpeg|png|woff|woff2|ico|csv|docx|xlsx|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
