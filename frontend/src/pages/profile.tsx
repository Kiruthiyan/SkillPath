import { useEffect } from "react";
import { useLocation } from "wouter";
import SettingsPage from "./settings";

export default function Profile() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/settings?tab=profile", { replace: true });
  }, [setLocation]);

  return <SettingsPage />;
}
