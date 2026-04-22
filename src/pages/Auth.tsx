import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Sparkles, ArrowRight, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { backendSetupMessage } from "@/lib/app-config";
import { cn } from "@/lib/utils";

type Mode = "signup" | "login";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, backend } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? "/";

  const submit = async () => {
    if (!email.trim() || !password.trim() || (mode === "signup" && !name.trim())) {
      toast.error("A couple of details are still missing.");
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "signup") {
        const result = await signUp({ email, password, name });

        if (result.requiresEmailConfirmation) {
          toast.success("Check your email to finish setting up Undo.");
          setMode("login");
          return;
        }

        toast.success("Your Undo account is ready.");
      } else {
        await signIn({ email, password });
        toast.success("Welcome back.");
      }

      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not open your Undo account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] opacity-70"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, hsl(var(--primary) / 0.09) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-12 pt-16">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3.5 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-soft backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
          Undo account
        </div>

        <h1 className="mt-7 max-w-[11ch] font-display text-[42px] leading-[1.01] tracking-snug text-foreground text-balance">
          Keep your protection with you.
        </h1>
        <p className="mt-4 max-w-[32rem] text-[14.5px] leading-relaxed text-muted-foreground text-balance">
          One calm account for the things Undo is watching, what you caught in time, and what still needs a decision.
        </p>

        <div className="mt-9 inline-flex rounded-full bg-surface/90 p-1 shadow-soft ring-1 ring-border/40">
          {[
            { value: "signup" as const, label: "Create account" },
            { value: "login" as const, label: "Log in" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors",
                mode === option.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-9 space-y-3 rounded-[30px] bg-card/95 p-6 shadow-card ring-1 ring-border/50">
          {mode === "signup" && (
            <Field
              icon={UserRound}
              label="Name"
              value={name}
              onChange={setName}
              placeholder="How Undo should greet you"
              autoComplete="name"
            />
          )}
          <Field
            icon={Mail}
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            type="email"
          />
          <Field
            icon={Lock}
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="A private password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            type="password"
          />

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[14px] font-medium text-background shadow-glow transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            {mode === "signup" ? "Start quietly protected" : "Open Undo"}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5 rounded-[28px] bg-primary-soft/60 p-5 ring-1 ring-primary/10">
          <p className="text-[12.5px] leading-relaxed text-foreground/80 text-balance">
            Undo keeps this simple. No inbox, no dashboards, no account maze. Just a calm place to keep what matters.
          </p>
        </div>

        <p className="mt-auto pt-7 text-center text-[11px] text-muted-foreground">
          {backendSetupMessage(backend)}
        </p>
      </div>
    </div>
  );
};

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  type = "text",
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-2xl bg-surface/85 px-4 py-3.5 ring-1 ring-border/50">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          type={type}
          className="w-full bg-transparent text-[13.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </label>
  );
}

export default Auth;
