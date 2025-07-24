"use client";

import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface HeaderProps {
	onLogin: () => void;
	onRegister: () => void;
}

export function Header({ onLogin, onRegister }: HeaderProps) {
	return (
		<header className="sticky top-0 z-50 border-slate-800 border-b bg-slate-900/50 backdrop-blur-sm">
			<div className="container mx-auto flex items-center justify-between px-4 py-4">
				<div className="flex items-center space-x-2">
					<Shield className="h-8 w-8 text-red-500" />
					<div>
						<h1 className="font-bold text-white text-xl">infosec.moscow</h1>
						<p className="text-slate-400 text-xs">Learning Management System</p>
					</div>
				</div>

				<div className="flex items-center space-x-3">
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
				</div>
			</div>
		</header>
	);
}
