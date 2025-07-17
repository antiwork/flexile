import { SignIn } from "@clerk/nextjs";

export default function Login() {
  return <SignIn signUpUrl="/signup" transferable={false} />;
}
