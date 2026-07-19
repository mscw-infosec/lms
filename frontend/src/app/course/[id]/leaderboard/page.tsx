"use client";

import { getCourseById } from "@/api/courses";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import CourseLeaderboard from "@/components/rating/course-leaderboard";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function CourseLeaderboardPage() {
	const { t } = useTranslation("common");
	const { user, loading: userLoading } = useUserStore();
	const params = useParams<{ id: string }>();
	const courseId = Number.parseInt(String(params.id));
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const canView = user?.role === "Teacher" || user?.role === "Admin";

	const courseQuery = useQuery({
		queryKey: ["course", courseId],
		queryFn: () => getCourseById(courseId),
		enabled: Number.isFinite(courseId) && canView,
		retry: false,
	});

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<main className="container mx-auto max-w-4xl px-4 py-8">
				<div className="mb-4">
					<Link href={`/course/${courseId}`}>
						<Button
							variant="outline"
							size="sm"
							className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							{t("back_to_course") || "Back to course"}
						</Button>
					</Link>
				</div>

				<h1 className="mb-1 font-bold text-2xl text-white">
					{t("rating_leaderboard") || "Leaderboard"}
				</h1>
				{courseQuery.data ? (
					<p className="mb-6 text-slate-400">{courseQuery.data.name}</p>
				) : (
					<div className="mb-6" />
				)}

				{userLoading ? (
					<div className="flex items-center gap-2 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : !canView ? (
					<div className="text-slate-400 text-sm">
						{t("not_authorized") || "You are not authorized to view this page."}
					</div>
				) : Number.isFinite(courseId) ? (
					<CourseLeaderboard courseId={courseId} />
				) : null}
			</main>
			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
