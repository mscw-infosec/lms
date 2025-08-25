"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GbFlag } from "./icons/gb-flag";
import { RuFlag } from "./icons/ru-flag";

export function LanguageToggle() {
	const { i18n } = useTranslation();

	const currentLang = useMemo(() => {
		const lng = i18n.language || "en";
		// Normalize e.g. en-US -> en
		return lng.split("-")[0];
	}, [i18n.language]);

	const Flag = currentLang === "ru" ? RuFlag : GbFlag;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-9 w-9 text-slate-300 hover:bg-slate-800"
					aria-label="Change language"
				>
					<Flag className="h-5 w-5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-40 border-slate-700 bg-slate-900 text-slate-200"
			>
				<DropdownMenuRadioGroup
					value={currentLang}
					onValueChange={(lng) => i18n.changeLanguage(lng)}
				>
					<DropdownMenuRadioItem
						value="en"
						className="hover:bg-slate-800 hover:text-slate-200 focus:bg-slate-800 focus:text-slate-200 data-[state=checked]:bg-slate-800"
					>
						<GbFlag className="h-4 w-4" />
						<span className="ml-2">English</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem
						value="ru"
						className="hover:bg-slate-800 hover:text-slate-200 focus:bg-slate-800 focus:text-slate-200 data-[state=checked]:bg-slate-800"
					>
						<RuFlag className="h-4 w-4" />
						<span className="ml-2">Русский</span>
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
