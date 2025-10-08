import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as any;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
    else navigate(location.state?.from?.pathname || "/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-emerald-900">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-emerald-800/80">
          Use your AxisOGreen account.
        </p>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          type="email"
          required
        />
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          type="password"
          required
        />
        <button
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          type="submit"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-xs text-emerald-800/70">
          Hint: create user chittoor@axisogreen.in in Supabase Auth with the
          provided password.
        </p>
      </form>
    </div>
  );
}
