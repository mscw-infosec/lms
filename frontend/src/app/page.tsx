"use client";

import { type UpsertCourseResponseDTO, getAllCourses } from "@/api/courses";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useUserStore } from "@/store/user";
import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function HomePage() {
	const { t, i18n } = useTranslation("common");
	const { user, hasToken, loading: authLoading } = useUserStore();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const coursesQuery = useQuery<UpsertCourseResponseDTO[], Error>({
		queryKey: ["courses"],
		queryFn: getAllCourses,
		retry: false,
		enabled: hasToken,
	});

	const canCreateCourse = user?.role === "Teacher" || user?.role === "Admin";

	const gradients = useMemo(
		() => [
			"bg-gradient-to-br from-red-500 to-orange-600",
			"bg-gradient-to-br from-blue-500 to-cyan-600",
			"bg-gradient-to-br from-purple-500 to-pink-600",
			"bg-gradient-to-br from-green-500 to-teal-600",
			"bg-gradient-to-br from-indigo-500 to-blue-600",
			"bg-gradient-to-br from-yellow-500 to-orange-600",
		],
		[],
	);

	const skeletonKeys = [
		"s1-7f0d",
		"s2-3a91",
		"s3-bc42",
		"s4-8d77",
		"s5-2ee9",
		"s6-9aa3",
	];

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>

			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<div className="mb-4 flex items-center justify-between">
						<h1 className="font-bold text-4xl text-white">Курсы</h1>
						{canCreateCourse && (
							<Link href="/courses/new">
								<Button className="bg-red-600 text-white hover:bg-red-700">
									<Plus className="mr-2 h-4 w-4" />
									{t("new_course")}
								</Button>
							</Link>
						)}
					</div>
					{/* Removed subheading to get rid of the old "освойте ИБ" text */}
				</div>

				{/* Auth loading state */}
				{authLoading && (
					<div className="flex min-h-[40vh] items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-slate-300" />
					</div>
				)}

				{/* Not logged in placeholder */}
				{!authLoading && !hasToken && (
					<div className="flex min-h-[40vh] items-center justify-center">
						<div className="max-w-xl text-center">
							<p className="mb-6 text-lg text-slate-300">
								{t("error_login_prompt")}
							</p>
							<div className="flex items-center justify-center gap-3">
								<Button
									variant="outline"
									onClick={() => setAuthModal("login")}
									className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
								>
									{t("login")}
								</Button>
								<Button
									onClick={() => setAuthModal("register")}
									className="bg-red-600 text-white hover:bg-red-700"
								>
									{t("register")}
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Authenticated: courses states */}
				{!authLoading && hasToken && coursesQuery.isLoading && (
					<div className="flex min-h-[40vh] items-center justify-center">
						<Loader2 className="h-8 w-8 animate-spin text-slate-300" />
					</div>
				)}

				{!authLoading &&
					hasToken &&
					!coursesQuery.isLoading &&
					coursesQuery.isError && (
						<div className="rounded-md border border-slate-800 bg-slate-900 p-4 text-slate-300">
							{coursesQuery.error?.message.includes("401")
								? t("error_login_prompt")
								: t("error_load_failed")}
						</div>
					)}

				{!authLoading &&
					hasToken &&
					!coursesQuery.isLoading &&
					!coursesQuery.isError &&
					coursesQuery.data &&
					coursesQuery.data.length === 0 && (
						<div className="text-slate-300">{t("no_courses")}</div>
					)}

				{!authLoading &&
					hasToken &&
					!coursesQuery.isLoading &&
					!coursesQuery.isError &&
					coursesQuery.data &&
					coursesQuery.data.length > 0 && (
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{coursesQuery.data.map((course) => (
								<Link key={course.id} href={`/course/${course.id}`}>
									<Card className="h-full cursor-pointer border-slate-800 bg-slate-900 transition-all duration-200 hover:scale-105 hover:border-slate-700">
										<CardHeader className="pb-3">
											<div
												className={`h-32 w-full rounded-lg ${gradients[course.id % gradients.length]} mb-3 flex items-center justify-center`}
											>
												<Shield className="h-12 w-12 text-white opacity-80" />
											</div>
											<CardTitle className="text-lg text-white leading-tight">
												{course.name}
											</CardTitle>
										</CardHeader>
										<CardContent className="pt-0">
											<CardDescription className="mb-3 text-slate-400 text-sm">
												{course.description ?? t("no_description")}
											</CardDescription>
											<div className="flex items-center text-slate-500 text-sm">
												<Clock className="mr-1 h-4 w-4" />
												{new Date(course.created_at).toLocaleDateString()}
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					)}
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
