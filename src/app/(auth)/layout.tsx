// Shared chrome for the auth screens: a centered, mobile-first single column.
// Composes tokens only (module-structure.md — app screens compose ui + layout).
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-12">
      <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
    </main>
  );
}
