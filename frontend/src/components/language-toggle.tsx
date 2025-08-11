"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GbFlag } from "./icons/gb-flag";
import { RuFlag } from "./icons/ru-flag";

export function LanguageToggle() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-x-2">
      <Button
        variant={i18n.language === "en" ? "outline" : "ghost"}
        size="icon"
        onClick={() => i18n.changeLanguage("en")}
        className="h-8 w-8"
      >
        <GbFlag className="h-5 w-5" />
      </Button>
      <Button
        variant={i18n.language === "ru" ? "outline" : "ghost"}
        size="icon"
        onClick={() => i18n.changeLanguage("ru")}
        className="h-8 w-8"
      >
        <RuFlag className="h-5 w-5" />
      </Button>
    </div>
  );
}
