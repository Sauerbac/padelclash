import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create account · PadelClash",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
