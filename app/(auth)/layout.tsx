import { QuotePanel } from "@/components/QuotePanel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full bg-parchment text-ink">
      {/* Warm parchment wash — matches the landing page so navigation
          from / → /login or / → /signup is visually continuous. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-parchment-radial"
      />
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        <QuotePanel />
        <main className="relative flex min-h-screen w-full items-center justify-center px-5 py-10 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
