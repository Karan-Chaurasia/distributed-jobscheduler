import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../../api/auth";
import { setSession, isAuthenticated } from "../../lib/auth";
import { Button, Field, inputClass } from "../../components/ui";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  if (isAuthenticated()) {
    navigate("/dashboard", { replace: true });
  }

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await authApi.login({ email: form.email, password: form.password })
          : await authApi.register(form);
      const data = res.data.data;
      setSession(data.accessToken, data.refreshToken, data.user);
      toast.success(`Welcome, ${data.user.firstName}`);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            JS
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Distributed Job Scheduler
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" ? "Sign in to your account" : "Create an account"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input
                    className={inputClass}
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className={inputClass}
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    required
                  />
                </Field>
              </div>
            )}
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
              />
            </Field>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium text-slate-900 hover:underline"
            >
              {mode === "login" ? "Register" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          The first account created becomes the platform administrator.
        </p>
      </div>
    </div>
  );
}
