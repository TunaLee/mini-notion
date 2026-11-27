import { currentUser } from "@/lib/auth";
import Notes from "./notes";

export default async function Page() {
  const user = await currentUser();
  return <Notes email={user?.email ?? null} />;
}
