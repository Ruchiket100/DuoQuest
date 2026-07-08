import React from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Input from "@/components/ui/Input.tsx";
import Button from "@/components/ui/Button.tsx";
import Card from "@/components/ui/Card.tsx";

export function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const setUser = useAuthStore((state) => state.setUser);
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("Please fill in all fields", "error");
      return;
    }

    setIsLoading(true);
    try {
      // Better Auth email login
      const response = await api.post<any>("/api/auth/sign-in/email", {
        email,
        password,
      });

      const token = response.token || response.session?.token;
      if (token) {
        localStorage.setItem("session_token", token);
      }

      setUser(response.user);
      addToast("Welcome back!", "success");
      navigate("/");
    } catch (err: any) {
      addToast(err.message || "Failed to log in", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black-deep flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Brand */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-lime-soft to-purple-warm w-16 h-16 rounded-2xl font-display font-extrabold text-2xl text-black shadow-glow-lime">
            DQ
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight text-white-off">
            DuoQuest
          </h1>
          <p className="text-sm text-white-muted font-medium">
            GitHub for Personal Growth. Multiplayer Accountability.
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-white/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>
        </Card>

        {/* Footer Links */}
        <p className="text-sm text-white-muted">
          New to DuoQuest?{" "}
          <Link
            to="/register"
            className="text-lime-soft hover:underline font-semibold"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
export default LoginPage;
