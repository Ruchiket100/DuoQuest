import React from "react";
import { Link, useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useUIStore } from "@/stores/uiStore.ts";
import api from "@/lib/api.ts";
import Input from "@/components/ui/Input.tsx";
import Button from "@/components/ui/Button.tsx";
import Card from "@/components/ui/Card.tsx";

export function RegisterPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const setUser = useAuthStore((state) => state.setUser);
  const addToast = useUIStore((state) => state.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !username) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    setIsLoading(true);
    try {
      // Better Auth email registration
      const response = await api.post<any>("/api/auth/sign-up/email", {
        email,
        password,
        name: displayName || username,
        username,
        displayName: displayName || username,
      });

      const token = response.token || response.session?.token;
      if (token) {
        localStorage.setItem("session_token", token);
      }

      setUser(response.user);
      addToast("Account created successfully!", "success");
      navigate("/onboarding");
    } catch (err: any) {
      addToast(err.message || "Failed to register", "error");
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
            Join DuoQuest
          </h1>
          <p className="text-sm text-white-muted font-medium">
            Partner up, complete tasks, keep streaking.
          </p>
        </div>

        {/* Register Card */}
        <Card className="border border-white/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="username"
              type="text"
              label="Username"
              placeholder="@ruchiket"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              required
            />

            <Input
              id="displayName"
              type="text"
              label="Display Name (Optional)"
              placeholder="Ruchiket"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

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
              label="Password (min 8 chars)"
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
              Sign Up
            </Button>
          </form>
        </Card>

        {/* Footer Links */}
        <p className="text-sm text-white-muted">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-lime-soft hover:underline font-semibold"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
export default RegisterPage;
