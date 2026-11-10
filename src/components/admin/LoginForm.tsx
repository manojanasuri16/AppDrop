"use client";
import { useActionState } from "react";
import { login, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, action] = useActionState(login, {} as ActionState);
  const err = state.error ? "login-err" : undefined;
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <style>{`@keyframes admin-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}`}</style>
      <div
        key={state.error ? `err-${Math.random()}` : "ok"}
        className="group-list"
        style={state.error ? { animation: "admin-shake .5s var(--ease-spring)" } : undefined}
      >
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password" name="password" type="password" required autoFocus autoComplete="current-password" placeholder="Password"
          className="block h-12 w-full bg-transparent px-4 transition-colors focus:bg-fill focus-visible:outline-none text-center text-body outline-none placeholder:text-label-3"
          aria-invalid={!!state.error} aria-describedby={err}
        />
        <label htmlFor="code" className="sr-only">Authenticator code</label>
        <input
          id="code" name="code" type="text" required inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} placeholder="6-digit code"
          className="block h-12 w-full bg-transparent px-4 transition-colors focus:bg-fill focus-visible:outline-none text-center text-body tracking-[0.35em] tabular-nums outline-none placeholder:tracking-normal placeholder:text-label-3"
          aria-invalid={!!state.error} aria-describedby={err}
          onInput={(e) => {
            const el = e.currentTarget;
            el.value = el.value.replace(/\D/g, "").slice(0, 6);
            const form = el.form;
            if (form && el.value.length === 6 && (form.elements.namedItem("password") as HTMLInputElement | null)?.value) form.requestSubmit();
          }}
        />
      </div>
      <p className="text-caption text-center text-label-2">Enter the code from your authenticator app.</p>
      {state.error && <p id="login-err" role="alert" className="text-footnote text-center text-danger">{state.error}</p>}
      <SubmitButton pendingLabel="Signing in…" className="w-full">Sign in</SubmitButton>
    </form>
  );
}
