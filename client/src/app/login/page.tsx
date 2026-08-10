"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCurrentUser, useLogin } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const authStatus = useAuthStore((state) => state.status);
  const currentUser = useCurrentUser(authStatus === "authenticated");
  const loginMutation = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (currentUser.isSuccess) {
      router.replace(nextPath);
    }
  }, [currentUser.isSuccess, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await loginMutation.mutateAsync({
      email,
      password,
    });

    router.replace(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">
            Bembex Portal
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Sign in
          </h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              disabled={loginMutation.isPending}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              disabled={loginMutation.isPending}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {loginMutation.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Invalid email or password.
            </p>
          ) : null}

          <button
            className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loginMutation.isPending}
            type="submit"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
