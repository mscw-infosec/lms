"use client";

import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/api/token";
import { getCurrentUser, type GetUserResponseDTO } from "@/api/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
	onLogin: () => void;
	onRegister: () => void;
}

export function Header({ onLogin, onRegister }: HeaderProps) {
	const [user, setUser] = useState<GetUserResponseDTO | null>(null);

	useEffect(() => {
		let active = true;

		const loadUser = async () => {
			const token = getAccessToken();
			if (!token) {
				if (active) setUser(null);
				return;
			}
			try {
				const me = await getCurrentUser();
				if (active) setUser(me);
			} catch {
				if (active) setUser(null);
			}
		};

		loadUser();

		const onTokenChange = () => {
			loadUser();
		};
		if (typeof window !== "undefined") {
			window.addEventListener("auth:token-changed", onTokenChange as EventListener);
		}
		return () => {
			active = false;
			if (typeof window !== "undefined") {
				window.removeEventListener("auth:token-changed", onTokenChange as EventListener);
			}
		};
	}, []);

	return (
		<header className="sticky top-0 z-50 border-slate-800 border-b bg-slate-900/50 backdrop-blur-sm">
			<div className="container mx-auto flex items-center justify-between px-4 py-4">
				<Link href="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
					<Shield className="h-8 w-8 text-red-500" />
					<div>
						<h1 className="font-bold text-white text-xl">infosec.moscow</h1>
						<p className="text-slate-400 text-xs">Learning Management System</p>
					</div>
				</Link>

				<div className="flex items-center space-x-3">
					{user ? (
						<Link href="/account" className="inline-flex">
							<Avatar className="h-9 w-9 ring-1 ring-slate-700">
								<AvatarFallback className="bg-slate-700 text-white">
									{user.username?.slice(0, 1).toUpperCase()}
								</AvatarFallback>
							</Avatar>
						</Link>
					) : (
						<>
							<Button
								variant="outline"
								onClick={onLogin}
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								Login
							</Button>
							<Button
								onClick={onRegister}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								Register
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
