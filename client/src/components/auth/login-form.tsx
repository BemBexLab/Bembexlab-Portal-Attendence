"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(result?.error ?? "Unable to sign in. Please try again.");
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/attendance";
      window.location.assign(nextPath);
    } catch {
      setError("Could not reach the login service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="portal-password">
          Password
        </label>
        <input
          autoComplete="current-password"
          autoFocus
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"
          id="portal-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={submitting} type="submit" variant="primary">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
