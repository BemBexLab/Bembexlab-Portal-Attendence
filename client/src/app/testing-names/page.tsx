import { redirect } from "next/navigation";

// Legacy debug route retained as a redirect; attendance is read from the VPS database.
export default function TestingNamesPage() {
  redirect("/dashboard");
}
