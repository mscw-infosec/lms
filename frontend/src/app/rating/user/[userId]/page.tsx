"use client";

import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import UserRating from "@/components/rating/user-rating";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function UserRatingPage() {
	const { t } = useTranslation("common");
	const { user, loading } = useUserStore();
	const params = useParams<{ userId: string }>();
	const userId = String(params.userId);
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const canView = user?.role === "Teacher" || user?.role === "Admin";

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<main className="container mx-auto max-w-4xl px-4 py-8">
				<div className="mb-6 flex items-center justify-between">
					<h1 className="font-bold text-2xl text-white">
						{t("rating_view") || "Rating"}
					</h1>
					<Link href="/admin/users">
						<Button
							variant="outline"
							size="sm"
							className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							{t("users") || "Users"}
						</Button>
					</Link>
				</div>

				{loading ? (
					<div className="flex items-center gap-2 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : !canView ? (
					<div className="text-slate-400 text-sm">
						{t("not_authorized") || "You are not authorized to view this page."}
					</div>
				) : (
					<UserRating userId={userId} />
				)}
			</main>
			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
