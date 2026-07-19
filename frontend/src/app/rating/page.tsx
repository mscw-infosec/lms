"use client";

import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import UserRating from "@/components/rating/user-rating";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function RatingPage() {
	const { t } = useTranslation("common");
	const { user, hasToken, loading } = useUserStore();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<main className="container mx-auto max-w-4xl px-4 py-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="font-bold text-2xl text-white">
						{t("rating_my_overall_title") || "My rating"}
					</h1>
					<Link href="/">
						<Button
							variant="outline"
							size="sm"
							className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
						>
							<Home className="mr-2 h-4 w-4" />
							{t("home") || "Home"}
						</Button>
					</Link>
				</div>

				{loading ? (
					<div className="flex items-center gap-2 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : !user && !hasToken ? (
					<div className="text-slate-400 text-sm">
						{t("rating_login_required") || "Please log in to view your rating."}
					</div>
				) : (
					<UserRating />
				)}
			</main>
			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
