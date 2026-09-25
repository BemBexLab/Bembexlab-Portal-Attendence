import { redirect } from "next/navigation";

// Temporarily disabled: this page reads full attendance histories directly
// from every ZKTeco device. Restore its prior implementation when re-enabled.
export default function TestingNamesPage() {
  redirect("/dashboard");
}
