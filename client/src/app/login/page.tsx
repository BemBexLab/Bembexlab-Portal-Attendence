import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-background p-7 shadow-sm">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Bembex Portal
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the portal password to continue.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
