import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Notes from "./notes";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Notes email={user.email} />;
}
