"use client";

import { type UpsertCourseResponseDTO, getAllCourses } from "@/api/courses";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Clock, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function HomePage() {
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const [courses, setCourses] = useState<UpsertCourseResponseDTO[] | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let active = true;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await getAllCourses();
				if (!active) return;
				setCourses(data);
			} catch (err) {
				if (!active) return;
				setError((err as Error).message || "Failed to load courses");
				setCourses(null);
			} finally {
				if (active) setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, []);

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
					<h1 className="mb-4 font-bold text-4xl text-white">
						Master Information Security
					</h1>
					<p className="max-w-2xl text-slate-300 text-xl">
						Learn from industry experts and advance your cybersecurity skills
						with hands-on courses designed for real-world scenarios.
					</p>
				</div>

				{loading && (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{skeletonKeys.map((key) => (
							<div
								key={key}
								className="h-64 animate-pulse rounded-lg bg-slate-800"
							/>
						))}
					</div>
				)}

				{!loading && error && (
					<div className="rounded-md border border-slate-800 bg-slate-900 p-4 text-slate-300">
						{error.includes("401")
							? "Please login to view courses."
							: "Failed to load courses. Try again later."}
					</div>
				)}

				{!loading && !error && courses && courses.length === 0 && (
					<div className="text-slate-300">No courses available.</div>
				)}

				{!loading && !error && courses && courses.length > 0 && (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{courses.map((course) => (
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
											{course.description ?? "No description"}
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
