import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "./form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}
