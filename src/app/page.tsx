import { redirect } from "next/navigation";

/** Landing: everyone goes to the app shell; sign-in is gated on actions that need credits. */
export default function Home() {
  redirect("/dashboard");
}
