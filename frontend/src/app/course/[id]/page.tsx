"use client";

import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
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
	Star,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const courseData = {
	1: {
		title: "Web Application Security Fundamentals",
		description:
			"Learn the basics of web application security, including OWASP Top 10 vulnerabilities and mitigation strategies.",
		image: "bg-gradient-to-br from-red-500 to-orange-600",
		duration: "8 hours",
		students: 1234,
		rating: 4.8,
		level: "Beginner",
		fullDescription: `This comprehensive course covers the fundamental concepts of web application security. You'll learn about common vulnerabilities, attack vectors, and defensive strategies used in modern web applications.

The course is designed for developers, security professionals, and anyone interested in understanding how to build and maintain secure web applications. Through hands-on exercises and real-world examples, you'll gain practical experience in identifying and mitigating security risks.

By the end of this course, you'll have a solid understanding of the OWASP Top 10, secure coding practices, and how to implement security controls in web applications.`,
		structure: [
			{
				id: 1,
				title: "Introduction to Web Security",
				lectures: [
					{
						id: 1,
						title: "What is Web Application Security?",
						type: "lecture",
						completed: false,
					},
					{
						id: 2,
						title: "Common Attack Vectors",
						type: "lecture",
						completed: false,
					},
					{
						id: 3,
						title: "Security Principles",
						type: "task",
						completed: false,
					},
				],
			},
			{
				id: 2,
				title: "OWASP Top 10",
				lectures: [
					{
						id: 4,
						title: "Injection Attacks",
						type: "lecture",
						completed: false,
					},
					{
						id: 5,
						title: "Broken Authentication",
						type: "lecture",
						completed: false,
					},
					{
						id: 6,
						title: "Sensitive Data Exposure",
						type: "lecture",
						completed: false,
					},
					{ id: 7, title: "OWASP Quiz", type: "task", completed: false },
				],
			},
			{
				id: 3,
				title: "Secure Development",
				lectures: [
					{
						id: 8,
						title: "Secure Coding Practices",
						type: "lecture",
						completed: false,
					},
					{
						id: 9,
						title: "Input Validation",
						type: "lecture",
						completed: false,
					},
					{ id: 10, title: "Final Assessment", type: "task", completed: false },
				],
			},
		],
	},
};

export default function CoursePage({ params }: { params: { id: string } }) {
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const courseId = Number.parseInt(params.id);
	const course = courseData[courseId as keyof typeof courseData];

	if (!course) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
				Course not found
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
								<span className="hidden sm:inline">Back to Courses</span>
								<span className="sm:hidden">Back</span>
							</Button>
						</Link>
					</div>
					{/* Course Header */}
					<div className="mb-6">
						<div className="flex flex-col gap-4">
							{/* Mobile: Image and basic info */}
							<div className="lg:hidden">
								<div
									className={`h-40 w-full rounded-lg ${course.image} mb-4 flex items-center justify-center`}
								>
									<Shield className="h-12 w-12 text-white opacity-80" />
								</div>
								<div className="mb-3 flex items-center gap-2">
									<Badge
										variant="secondary"
										className="bg-slate-800 text-slate-300 text-xs"
									>
										{course.level}
									</Badge>
									<div className="flex items-center text-yellow-400">
										<Star className="mr-1 h-3 w-3 fill-current" />
										<span className="text-xs">{course.rating}</span>
									</div>
								</div>
								<h1 className="mb-3 font-bold text-2xl text-white">
									{course.title}
								</h1>
								<div className="mb-4 flex items-center gap-4 text-slate-400 text-sm">
									<div className="flex items-center">
										<Clock className="mr-1 h-3 w-3" />
										{course.duration}
									</div>
									<div className="flex items-center">
										<Users className="mr-1 h-3 w-3" />
										{course.students.toLocaleString()}
									</div>
								</div>
								<Link href={`/course/${courseId}/learn`}>
									<Button
										size="default"
										className="w-full bg-red-600 text-white hover:bg-red-700"
									>
										<Play className="mr-2 h-4 w-4" />
										Start Course
									</Button>
								</Link>
							</div>

							{/* Desktop: Side by side layout */}
							<div className="hidden lg:flex lg:gap-8">
								<div
									className={`h-48 w-80 rounded-lg ${course.image} flex flex-shrink-0 items-center justify-center`}
								>
									<Shield className="h-16 w-16 text-white opacity-80" />
								</div>

								<div className="flex-1">
									<div className="mb-4 flex items-center gap-2">
										<Badge
											variant="secondary"
											className="bg-slate-800 text-slate-300"
										>
											{course.level}
										</Badge>
										<div className="flex items-center text-yellow-400">
											<Star className="mr-1 h-4 w-4 fill-current" />
											<span className="text-sm">{course.rating}</span>
										</div>
									</div>

									<h1 className="mb-4 font-bold text-3xl text-white">
										{course.title}
									</h1>

									<div className="mb-6 flex items-center gap-6 text-slate-400">
										<div className="flex items-center">
											<Clock className="mr-2 h-4 w-4" />
											{course.duration}
										</div>
										<div className="flex items-center">
											<Users className="mr-2 h-4 w-4" />
											{course.students.toLocaleString()} students
										</div>
									</div>

									<Link href={`/course/${courseId}/learn`}>
										<Button
											size="lg"
											className="bg-red-600 text-white hover:bg-red-700"
										>
											<Play className="mr-2 h-5 w-5" />
											Start Course
										</Button>
									</Link>
								</div>
							</div>
						</div>
					</div>

					{/* Course Description */}
					<Card className="mb-8 border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">About This Course</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="whitespace-pre-line text-slate-300">
								{course.fullDescription}
							</div>
						</CardContent>
					</Card>

					{/* Course Structure */}
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">Course Structure</CardTitle>
							<CardDescription className="text-slate-400">
								{course.structure.length} modules •{" "}
								{course.structure.reduce(
									(acc, module) => acc + module.lectures.length,
									0,
								)}{" "}
								lessons
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{course.structure.map((module) => (
								<Collapsible key={module.id} defaultOpen>
									<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-4 transition-colors hover:bg-slate-700">
										<div className="flex items-center">
											<BookOpen className="mr-3 h-5 w-5 text-slate-400" />
											<span className="font-medium text-white">
												{module.title}
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
