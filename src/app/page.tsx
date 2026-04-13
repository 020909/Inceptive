import { redirect } from "next/navigation";

/** Root URL opens the product dashboard directly. */
export default function Home() {
  redirect("/dashboard");
}
