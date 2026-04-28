import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || "https://inceptive.ai";

  return (
    <div className="min-h-svh flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] px-6">
      <div className="w-full max-w-[520px] rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-container)] p-8">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
            <Image src="/logo.png" alt="Inceptive" fill sizes="40px" className="object-contain" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Inceptive
            </div>
            <div className="text-[15px] font-semibold truncate">Command center</div>
          </div>
        </div>

        <h1 className="mt-6 text-[22px] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          Continue to the app
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted-foreground)]">
          Sign in to access your workspace. New here? You’ll get a quick guided tour inside the product.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 text-[11px] text-[var(--muted-foreground)]">
          <span className="truncate">Looking for the public site?</span>
          <a
            href={marketingUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Visit marketing site
          </a>
        </div>
      </div>
    </div>
  );
}
