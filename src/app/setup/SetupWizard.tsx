"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "@/components/AvatarPicker";
import { useToast } from "@/components/Toast";
import { api, ApiFailure } from "@/lib/client/api";
import {
  DANCE_STYLES,
  GENDERS,
  POPULAR_CITIES,
  SKILL_LEVELS,
} from "@/lib/constants";

type Draft = {
  name: string;
  gender: string;
  age: number | null;
  city: string;
  state: string;
  bio: string;
  danceStyles: string[];
  skillLevel: string;
  avatarUrl: string | null;
};

const STEPS = ["Photo", "About you", "Your style"] as const;

export function SetupWizard({
  initial,
  editing,
}: {
  initial: Draft;
  editing: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleStyle = (style: string) =>
    setDraft((d) => ({
      ...d,
      danceStyles: d.danceStyles.includes(style)
        ? d.danceStyles.filter((s) => s !== style)
        : [...d.danceStyles, style],
    }));

  const stepValid =
    step === 0
      ? true
      : step === 1
        ? draft.name.trim().length >= 2 &&
          Boolean(draft.gender) &&
          Boolean(draft.age) &&
          draft.age! >= 16 &&
          draft.city.trim().length >= 2
        : draft.danceStyles.length > 0 && Boolean(draft.skillLevel);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/api/profile", {
        name: draft.name.trim(),
        gender: draft.gender,
        age: draft.age,
        city: draft.city.trim(),
        state: draft.state.trim() || null,
        bio: draft.bio.trim() || null,
        danceStyles: draft.danceStyles,
        skillLevel: draft.skillLevel,
      });
      toast.show(editing ? "Profile updated." : "Welcome to the circle!", "success");
      router.replace("/garba");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiFailure && error.data.field) {
        setStep(error.data.field === "name" ? 1 : 2);
      }
      toast.show(
        error instanceof Error ? error.message : "Could not save.",
        "error",
      );
      setBusy(false);
    }
  };

  return (
    <main className="app-shell flex min-h-dvh flex-col pt-safe pb-safe">
      <header className="py-5">
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  i <= step ? "bg-gradient-to-r from-marigold to-marigold-deep" : "bg-cream/15"
                }`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[12.5px] font-semibold uppercase tracking-[0.2em] text-marigold/80">
          Step {step + 1} of 3 {"\u00b7"} {STEPS[step]}
        </p>
      </header>

      <div key={step} className="animate-rise flex-1 pb-4">
        {step === 0 && (
          <section>
            <h1 className="font-display text-[28px] font-extrabold leading-tight">
              Show your smile
            </h1>
            <p className="mt-1.5 text-[15px] leading-snug text-cream/65">
              A real photo gets far more dandiya invites. You can skip it, but
              profiles with photos get matched three times as often.
            </p>
            <div className="mt-8">
              <AvatarPicker
                value={draft.avatarUrl}
                name={draft.name}
                onChange={(url) => set("avatarUrl", url)}
              />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <div>
              <h1 className="font-display text-[28px] font-extrabold leading-tight">
                About you
              </h1>
              <p className="mt-1.5 text-[15px] leading-snug text-cream/65">
                This is what the circle sees. Your mobile number never is.
              </p>
            </div>

            <Field label="Your name">
              <input
                className="field focus:field-focus"
                value={draft.name}
                maxLength={40}
                autoComplete="given-name"
                placeholder="Priya"
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>

            <Field label="You are">
              <div className="flex gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => set("gender", g.key)}
                    className={`chip flex-1 justify-center ${draft.gender === g.key ? "chip-on" : ""}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <input
                  className="field focus:field-focus"
                  type="number"
                  inputMode="numeric"
                  min={16}
                  max={80}
                  placeholder="24"
                  value={draft.age ?? ""}
                  onChange={(e) =>
                    set("age", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </Field>
              <Field label="City">
                <input
                  className="field focus:field-focus"
                  list="cities"
                  placeholder="Ahmedabad"
                  value={draft.city}
                  maxLength={60}
                  onChange={(e) => set("city", e.target.value)}
                />
                <datalist id="cities">
                  {POPULAR_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <div>
              <h1 className="font-display text-[28px] font-extrabold leading-tight">
                Your style
              </h1>
              <p className="mt-1.5 text-[15px] leading-snug text-cream/65">
                What do you love to dance, and how many rounds can you survive?
              </p>
            </div>

            <Field label="I dance">
              <div className="flex flex-wrap gap-2">
                {DANCE_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`chip ${draft.danceStyles.includes(style) ? "chip-on" : ""}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="My level">
              <div className="space-y-2">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level.key}
                    type="button"
                    onClick={() => set("skillLevel", level.key)}
                    className={`panel flex w-full items-center gap-3 p-3.5 text-left transition-colors ${
                      draft.skillLevel === level.key
                        ? "border-marigold/70 bg-marigold/10"
                        : ""
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                        draft.skillLevel === level.key
                          ? "border-marigold bg-marigold"
                          : "border-cream/30"
                      }`}
                    >
                      {draft.skillLevel === level.key && (
                        <span className="h-1.5 w-1.5 rounded-full bg-night" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[15.5px] font-bold">
                        {level.label}
                      </span>
                      <span className="block text-[13px] text-cream/60">
                        {level.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="One line about you (optional)">
              <textarea
                className="field min-h-[92px] resize-none focus:field-focus"
                maxLength={240}
                placeholder="Raas till 2am, chai after. Looking for someone who knows the 12-step."
                value={draft.bio}
                onChange={(e) => set("bio", e.target.value)}
              />
              <p className="mt-1 text-right text-[12px] text-cream/40">
                {draft.bio.length}/240
              </p>
            </Field>
          </section>
        )}
      </div>

      <div className="flex gap-3 pb-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="btn-ghost w-auto px-6"
          >
            Back
          </button>
        )}
        <button
          type="button"
          disabled={!stepValid || busy}
          onClick={() => (step === 2 ? save() : setStep((s) => s + 1))}
          className="btn-primary active:btn-primary-active disabled:opacity-45"
        >
          {busy
            ? "Saving…"
            : step === 2
              ? editing
                ? "Save profile"
                : "Enter the circle"
              : step === 0 && !draft.avatarUrl
                ? "Skip for now"
                : "Continue"}
        </button>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13.5px] font-semibold tracking-wide text-cream/70">
        {label}
      </span>
      {children}
    </label>
  );
}
