import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · PadelClash",
};

// `?verified=1` is appended by the email-verification redirect (see RegisterForm)
// so we can greet a freshly-verified visitor. searchParams is async in Next 15.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  return <LoginForm verified={verified === "1"} />;
}
