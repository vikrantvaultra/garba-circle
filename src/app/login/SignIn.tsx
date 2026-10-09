"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiFailure } from "@/lib/client/api";
import { chromeIntent, useInAppBrowser } from "@/lib/client/in-app";
import { useToast } from "@/components/Toast";

/** Google's four-colour "G", as their branding guidelines ask for. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * A plain link, not a fetch: the browser has to leave for Google and come
 * back. Inside Instagram or Facebook, Google refuses to sign anyone in, so
 * those visitors are pointed to a real browser instead.
 */
export function GoogleButton({ href }: { href: string }) {
  const inApp = useInAppBrowser();
  const [leaving, setLeaving] = useState(false);

  if (inApp) {
    return (
      <div className="panel space-y-3 rounded-3xl px-5 py-4 text-[14px] leading-normal text-choco-2">
        <p className="font-extrabold text-choco">Open this page in your browser to sign in</p>
        <p>Google doesn&rsquo;t allow sign-in from inside this app.</p>
        {inApp === "android" ? (
          <a href={chromeIntent()} className="btn-primary active:btn-primary-active">
            Open in Chrome
          </a>
        ) : (
          <p className="font-semibold">Tap ⋯ at the top, then &ldquo;Open in browser&rdquo;.</p>
        )}
      </div>
    );
  }

  return (
    <a
      href={href}
      onClick={() => setLeaving(true)}
      aria-busy={leaving}
      className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-choco/15 bg-white px-5 text-[16px] font-extrabold text-choco shadow-sm transition-colors active:bg-wafer/60"
    >
      <GoogleMark />
      {leaving ? "Opening Google…" : "Continue with Google"}
    </a>
  );
}

type Mode = "signin" | "register";

const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

/**
 * Username and password, for anyone who'd rather not use Google. There is no
 * email or phone behind these accounts, so a forgotten password can't be
 * reset; the form says so when they register.
 *
 * Submitting reads the fields themselves, not React state: browsers autofill
 * saved passwords without firing change events (Chrome holds the value back
 * until the page is touched), so state alone would see an empty form while
 * the fields look full.
 */
export function PasswordForm({ next, google }: { next: string | null; google: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);

  const clean = username.trim().toLowerCase();
  const usernameOk = USERNAME_PATTERN.test(clean);
  const registering = mode === "register";

  // Say a username is taken while they type, not after they submit.
  useEffect(() => {
    if (!registering || !usernameOk) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ available: boolean }>(
          `/api/auth/register?username=${encodeURIComponent(clean)}`,
        );
        if (live) setTaken(!res.available);
      } catch {
        /* the submit will say so */
      }
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
      setTaken(false);
    };
  }, [clean, registering, usernameOk]);

  const mismatch = registering && confirm.length > 0 && confirm !== password;

  /** Why the form can't be sent as filled in, or null. */
  const problem = (name: string, pass: string, again: string): string | null => {
    if (!name || !pass) return "Enter your username and password.";
    if (!registering) return null;
    if (!USERNAME_PATTERN.test(name)) return "Usernames are 3–20 letters, numbers, dots or underscores.";
    if (pass.length < 8) return "Use at least 8 characters for your password.";
    if (again !== pass) return "Passwords don’t match.";
    if (taken) return "That username is taken. Try another.";
    return null;
  };

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const raw = String(data.get("username") ?? "").replace(/\s/g, "");
    const pass = String(data.get("password") ?? "");
    const again = String(data.get("confirm") ?? "");
    // Catch state up with whatever the browser filled in.
    setUsername(raw);
    setPassword(pass);
    if (registering) setConfirm(again);

    const name = raw.toLowerCase();
    const why = problem(name, pass, again);
    if (why) {
      toast.show(why, "error");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post<{ profileComplete: boolean }>(
        registering ? "/api/auth/register" : "/api/auth/login",
        { username: name, password: pass },
      );
      router.replace(res.profileComplete ? (next ?? "/garba") : "/setup");
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 409) setTaken(true);
      toast.show(error instanceof Error ? error.message : "Try again.", "error");
      setBusy(false);
    }
  };

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => {
        setMode(value);
        setConfirm("");
      }}
      className={`flex-1 rounded-full py-2 text-[14px] font-extrabold transition-colors ${
        mode === value ? "bg-white text-brand shadow-sm" : "text-choco-2"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form
      className="panel space-y-3 rounded-3xl p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void submit(e.currentTarget);
      }}
    >
      <div role="tablist" className="flex gap-1 rounded-full bg-wafer/60 p-1">
        {tab("signin", "Sign in")}
        {tab("register", "Create account")}
      </div>

      <label className="block">
        <span className="mb-1 block text-[13px] font-extrabold text-choco-2">Username</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
          className="field w-full"
          aria-invalid={registering && (taken || (username.length > 0 && !usernameOk))}
        />
        {registering && username.length > 0 && (
          <span className={`mt-1 block text-[12px] font-semibold ${taken || !usernameOk ? "text-brand" : "text-cocoa"}`}>
            {taken
              ? "That username is taken."
              : usernameOk
                ? "Only used to sign in. Others see the name you choose next."
                : "3–20 letters, numbers, dots or underscores."}
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-[13px] font-extrabold text-choco-2">Password</span>
        <span className="relative block">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full pr-16"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute inset-y-0 right-3 text-[12.5px] font-extrabold text-brand"
          >
            {show ? "Hide" : "Show"}
          </button>
        </span>
        {registering && (
          <span className="mt-1 block text-[12px] font-semibold text-cocoa">At least 8 characters.</span>
        )}
      </label>

      {registering && (
        <label className="block">
          <span className="mb-1 block text-[13px] font-extrabold text-choco-2">Confirm password</span>
          <input
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field w-full"
            aria-invalid={mismatch}
          />
          {mismatch && (
            <span className="mt-1 block text-[12px] font-semibold text-brand">Passwords don&rsquo;t match.</span>
          )}
        </label>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary active:btn-primary-active disabled:opacity-45"
      >
        {busy ? "One moment…" : registering ? "Create account" : "Sign in"}
      </button>

      {registering && (
        <p className="text-center text-[12px] leading-snug text-cocoa">
          Keep your password safe: without an email we can&rsquo;t reset it.
          {google && " Signing in with Google avoids that."}
        </p>
      )}
    </form>
  );
}
