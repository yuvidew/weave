import { SignUp } from "@clerk/nextjs";

/**
 * @component SignUpPage
 * @description Clerk-hosted sign-up screen, centered on the page.
 */
const SignUpPage = () => {
  return (
    <main
      className="flex min-h-[100vh] items-center justify-center"
    >
      <SignUp />
    </main>
  );
}

export default SignUpPage;
