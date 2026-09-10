import { SignIn } from "@clerk/nextjs";

/**
 * @component SignInPage
 * @description Clerk-hosted sign-in screen, centered on the page.
 */
const SignInPage = () => {
  return (
    <main className="flex min-h-[100vh] items-center justify-center">
      <SignIn />
    </main>
  );
}

export default SignInPage;
