import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main 
      className="flex min-h-[100vh] items-center justify-center"
    >
      <SignUp />
    </main>
  );
}
