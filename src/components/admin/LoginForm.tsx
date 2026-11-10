"use client";
import { useActionState } from "react";
import { login, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(login, {} as ActionState);
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <style>{`@keyframes admin-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}`}</style>
      <div key={state.error ? "err" : "ok"} style={state.error ? { animation: "admin-shake .5s var(--ease-spring)" } : undefined}>
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password" name="password" type="password" required autoFocus autoComplete="current-password" placeholder="Password"
          className="field !h-12 text-center" aria-invalid={!!state.error} aria-describedby={state.error ? "login-err" : undefined}
        />
      </div>
      {state.error && <p id="login-err" role="alert" className="text-footnote text-center text-danger">{state.error}</p>}
      <SubmitButton pendingLabel="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}
