import { Outlet, Navigate } from "react-router";
import { useAuthStore } from "@/stores/authStore.ts";
import { useQuery } from "@tanstack/react-query";
import { useDuoSpaceStore } from "@/stores/duoSpaceStore.ts";
import api from "@/lib/api.ts";
import React from "react";
import Header from "./Header.tsx";
import BottomNav from "./BottomNav.tsx";
import ToastContainer from "@/components/ui/Toast.tsx";

import { registerPushNotifications } from "@/lib/pushNotification.ts";

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { activeDuoSpace, setActiveDuoSpace } = useDuoSpaceStore();

  // Load user profile globally if authenticated
  const { data: profileData } = useQuery<any>({
    queryKey: ["userProfile"],
    queryFn: () => api.get("/api/users/me"),
    enabled: isAuthenticated && !activeDuoSpace,
  });

  React.useEffect(() => {
    const memberSpace = profileData?.duoMemberships?.[0]?.duoSpace;
    if (memberSpace && !activeDuoSpace) {
      setActiveDuoSpace(memberSpace);
    }
  }, [profileData, activeDuoSpace, setActiveDuoSpace]);

  React.useEffect(() => {
    if (isAuthenticated) {
      registerPushNotifications();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black-deep flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-purple-warm/20" />
            <div className="absolute inset-0 rounded-full border-4 border-lime-soft border-t-transparent animate-spin" />
          </div>
          <span className="text-sm font-semibold text-white-muted animate-pulse">Loading space...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-black-deep flex flex-col pb-16">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}
export default AppLayout;
