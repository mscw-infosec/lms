"use client";

import type { GetUserResponseDTO } from "@/api/auth";
import { logoutAllSessions } from "@/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/store/user";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./language-toggle";

interface HeaderProps {
	onLogin: () => void;
	onRegister: () => void;
}

export function Header({ onLogin, onRegister }: HeaderProps) {
	const { user, hasToken, loading, avatarSrc, avatarExists } = useUserStore();
	const { t } = useTranslation("common");
	const router = useRouter();
	const [loggingOut, setLoggingOut] = useState(false);

	const userInitial = useMemo(
		() => user?.username?.slice(0, 1).toUpperCase() ?? undefined,
		[user?.username],
	);

	return (
		<header className="sticky top-0 z-50 border-slate-800 border-b bg-slate-900/50 backdrop-blur-sm">
			<div className="container mx-auto flex items-center justify-between px-4 py-4">
				<Link
					href="/"
					className="flex items-center space-x-2 transition-opacity hover:opacity-90"
				>
					<Shield className="h-8 w-8 text-red-500" />
					<div>
						<h1 className="font-bold text-white text-xl">infosec.moscow</h1>
						<p className="text-slate-400 text-xs">{t("lms_tagline")}</p>
					</div>
				</Link>

				<div className="flex items-center space-x-3">
					{user && (user.role === "Teacher" || user.role === "Admin") ? (
						<Link href="/tasks" className="hidden sm:inline-flex">
							<Button
								variant="outline"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								{t("tasks")}
							</Button>
						</Link>
					) : null}
					<LanguageToggle />
					{user ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button aria-label="User menu" className="inline-flex">
									<Avatar className="h-9 w-9 ring-1 ring-slate-700">
										<AvatarImage
											src={avatarSrc}
											alt={user?.username || t("account_alt")}
										/>
										<AvatarFallback
											className={
												avatarExists
													? "animate-pulse bg-slate-700"
													: "bg-slate-700 text-white"
											}
										>
											{avatarExists ? null : userInitial}
										</AvatarFallback>
									</Avatar>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-48 border-slate-700 bg-slate-900 text-slate-200"
							>
								<Link
									href="/account"
									className="block rounded-sm px-3 py-2 text-sm hover:bg-slate-800"
								>
									{t("account") || "Account"}
								</Link>
								<button
									onClick={async () => {
										if (loggingOut) return;
										setLoggingOut(true);
										try {
											await logoutAllSessions();
										} finally {
											setLoggingOut(false);
											router.push("/");
										}
									}}
									disabled={loggingOut}
									className="block w-full rounded-sm px-3 py-2 text-left text-red-400 text-sm hover:bg-slate-800 hover:text-red-300 disabled:opacity-50"
								>
									{loggingOut
										? t("logging_out") || "Logging out..."
										: t("logout") || "Logout"}
								</button>
							</DropdownMenuContent>
						</DropdownMenu>
					) : hasToken ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button aria-label="User menu" className="inline-flex">
									<Avatar className="h-9 w-9 ring-1 ring-slate-700">
										<AvatarFallback className="bg-slate-700" />
									</Avatar>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="w-48 border-slate-700 bg-slate-900 text-slate-200"
							>
								<Link
									href="/account"
									className="block rounded-sm px-3 py-2 text-sm hover:bg-slate-800"
								>
									{t("account") || "Account"}
								</Link>
							</DropdownMenuContent>
						</DropdownMenu>
					) : !loading && !user ? (
						<>
							<Button
								variant="outline"
								onClick={onLogin}
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								{t("login")}
							</Button>
							<Button
								onClick={onRegister}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								{t("register")}
							</Button>
						</>
					) : (
						<></>
					)}
				</div>
			</div>
		</header>
	);
}
