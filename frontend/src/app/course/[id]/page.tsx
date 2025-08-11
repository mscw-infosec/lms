"use client";

import {
	type TopicResponseDTO,
	type UpsertCourseResponseDTO,
	getCourseById,
	getCourseTopics,
} from "@/api/courses";
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	BookOpen,
	CheckCircle2,
	ChevronDown,
	Clock,
	HelpCircle,
	Home,
	Play,
	Shield,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function CoursePage() {
	const { t } = useTranslation('common');
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const params = useParams<{ id: string }>();
	const courseId = Number.parseInt(String(params.id));

	const [course, setCourse] = useState<UpsertCourseResponseDTO | null>(null);
	const [topics, setTopics] = useState<TopicResponseDTO[] | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await getCourseById(courseId);
				if (!active) return;
				setCourse(data);
			} catch (err) {
				if (!active) return;
				setError((err as Error).message || "Failed to load course");
				setCourse(null);
			} finally {
				if (active) setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, [courseId]);

	useEffect(() => {
		let active = true;
		(async () => {
			try {
				const data = await getCourseTopics(courseId);
				if (!active) return;
				setTopics(data.sort((a, b) => a.order_index - b.order_index));
			} catch {
				if (!active) return;
				setTopics([]);
			}
		})();
		return () => {
			active = false;
		};
	}, [courseId]);

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

	const courseImageClass = gradients[courseId % gradients.length];

	const structure = useMemo(
		() => [
			{
				id: 1,
				title: "Topics",
				lectures: (topics ?? []).map((t) => ({
					id: t.id,
					title: t.title,
					type: "lecture" as const,
					completed: false,
				})),
			},
		],
		[topics],
	);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				{t('loading_course')}
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				{error?.includes("401")
					? t('course_login_prompt')
					: t('course_not_found')}
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>

			<main className="container mx-auto px-4 py-8">
				<div className="mx-auto max-w-4xl">
					{/* Home Button */}
					<div className="mb-4">
						<Link href="/">
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								<Home className="mr-2 h-4 w-4" />
								<span className="hidden sm:inline">{t('back_to_courses')}</span>
								<span className="sm:hidden">{t('back')}</span>
							</Button>
						</Link>
					</div>
					{/* Course Header */}
					<div className="mb-6">
						<div className="flex flex-col gap-4">
							{/* Mobile: Image and basic info */}
							<div className="lg:hidden">
								<div
									className={`h-40 w-full rounded-lg ${courseImageClass} mb-4 flex items-center justify-center`}
								>
									<Shield className="h-12 w-12 text-white opacity-80" />
								</div>
								<h1 className="mb-3 font-bold text-2xl text-white">
									{course.name}
								</h1>
								<div className="mb-4 flex items-center gap-4 text-slate-400 text-sm">
									<div className="flex items-center">
										<Clock className="mr-1 h-3 w-3" />
										{new Date(course.created_at).toLocaleDateString()}
									</div>
								</div>
								<Link href={`/course/${courseId}/learn`}>
									<Button
										size="default"
										className="w-full bg-red-600 text-white hover:bg-red-700"
									>
										<Play className="mr-2 h-4 w-4" />
										{t('start_course')}
									</Button>
								</Link>
							</div>

							{/* Desktop: Side by side layout */}
							<div className="hidden lg:flex lg:gap-8">
								<div
									className={`h-48 w-80 rounded-lg ${courseImageClass} flex flex-shrink-0 items-center justify-center`}
								>
									<Shield className="h-16 w-16 text-white opacity-80" />
								</div>

								<div className="flex-1">
									<h1 className="mb-4 font-bold text-3xl text-white">
										{course.name}
									</h1>

									<div className="mb-6 flex items-center gap-6 text-slate-400">
										<div className="flex items-center">
											<Clock className="mr-2 h-4 w-4" />
											{new Date(course.created_at).toLocaleDateString()}
										</div>
									</div>

									<Link href={`/course/${courseId}/learn`}>
										<Button
											size="lg"
											className="bg-red-600 text-white hover:bg-red-700"
										>
											<Play className="mr-2 h-5 w-5" />
											{t('start_course')}
										</Button>
									</Link>
								</div>
							</div>
						</div>
					</div>

					{/* Course Description */}
					<Card className="mb-8 border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">{t('about_course')}</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="whitespace-pre-line text-slate-300">
								{course.description ?? t('no_description')}
							</div>
						</CardContent>
					</Card>

					{/* Course Structure */}
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">{t('course_structure')}</CardTitle>
							<CardDescription className="text-slate-400">
								{t('course_structure_modules_lessons', {
									modules: structure.length,
									lessons: structure.reduce((acc, m) => acc + m.lectures.length, 0),
								})}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{structure.map((module) => (
								<Collapsible key={module.id} defaultOpen>
									<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-4 transition-colors hover:bg-slate-700">
										<div className="flex items-center">
											<BookOpen className="mr-3 h-5 w-5 text-slate-400" />
											<span className="font-medium text-white">
												{t('topics')}
											</span>
										</div>
										<ChevronDown className="h-5 w-5 text-slate-400" />
									</CollapsibleTrigger>
									<CollapsibleContent className="mt-2 ml-8 space-y-2">
										{module.lectures.map((lecture) => (
											<div
												key={lecture.id}
												className="flex items-center rounded-lg bg-slate-800/50 p-3"
											>
												<div className="flex flex-1 items-center">
													{lecture.completed ? (
														<CheckCircle2 className="mr-3 h-4 w-4 text-green-500" />
													) : (
														<div className="mr-3 h-4 w-4 rounded-full border-2 border-slate-600" />
													)}
													{lecture.type === "lecture" ? (
														<Play className="mr-3 h-4 w-4 text-blue-400" />
													) : (
														<HelpCircle className="mr-3 h-4 w-4 text-orange-400" />
													)}
													<span className="text-slate-300">
														{lecture.title}
													</span>
												</div>
											</div>
										))}
									</CollapsibleContent>
								</Collapsible>
							))}
						</CardContent>
					</Card>
				</div>
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
