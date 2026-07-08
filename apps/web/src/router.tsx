import React from "react";
import { Routes, Route } from "react-router";
import AppLayout from "@/components/layout/AppLayout.tsx";
import LoginPage from "@/features/auth/pages/LoginPage.tsx";
import RegisterPage from "@/features/auth/pages/RegisterPage.tsx";
import OnboardingPage from "@/features/auth/pages/OnboardingPage.tsx";
import HomePage from "@/features/home/pages/HomePage.tsx";
import GoalsPage from "@/features/goals/pages/GoalsPage.tsx";
import GoalDetailPage from "@/features/goals/pages/GoalDetailPage.tsx";
import ChatPage from "@/features/chat/pages/ChatPage.tsx";
import StatsPage from "@/features/stats/pages/StatsPage.tsx";
import ProfilePage from "@/features/profile/pages/ProfilePage.tsx";
import ChallengesPage from "@/features/challenges/pages/ChallengesPage.tsx";
import NotificationsPage from "@/features/notifications/pages/NotificationsPage.tsx";
import { JournalPage } from "@/features/journal/pages/JournalPage.tsx";
import { JournalEditorPage } from "@/features/journal/pages/JournalEditorPage.tsx";
import { useAuthStore } from "@/stores/authStore.ts";
import api from "@/lib/api.ts";

export default function AppRoutes() {
  const { setUser, setLoading } = useAuthStore();

  // Handle auto-login session restore on initial boot
  React.useEffect(() => {
    async function restoreSession() {
      try {
        const response = await api.get<any>("/api/users/me");
        if (response) {
          setUser(response);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, [setUser, setLoading]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* Protected Pages (wrapped in AppLayout containing guards and skeleton screens) */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/:id" element={<GoalDetailPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/journal/new" element={<JournalEditorPage />} />
        <Route path="/journal/edit/:id" element={<JournalEditorPage />} />
      </Route>
    </Routes>
  );
}
