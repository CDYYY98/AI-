import { useState } from "react";
import DesktopUpdateCard from "@/components/layout/DesktopUpdateCard";
import AutoDirectorSettingsSection from "./AutoDirectorSettingsSection";
import SettingsNavigationCards from "./components/SettingsNavigationCards";
import StyleEngineRuntimeSettingsCard from "./components/StyleEngineRuntimeSettingsCard";
import SettingsActionResult from "./SettingsActionResult";
import { AUTO_DIRECTOR_MOBILE_CLASSES } from "@/mobile/autoDirector";

export default function SettingsPage() {
  const [actionResult, setActionResult] = useState("");

  return (
    <div className={AUTO_DIRECTOR_MOBILE_CLASSES.settingsPageRoot}>
      <DesktopUpdateCard />
      <SettingsNavigationCards />
      <StyleEngineRuntimeSettingsCard />

      <AutoDirectorSettingsSection onActionResult={setActionResult} />

      <SettingsActionResult message={actionResult} />
    </div>
  );
}
