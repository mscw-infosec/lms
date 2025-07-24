"use client";

import { LecturePlayer } from "@/components/lecture-player";
import { TaskPlayer } from "@/components/task-player";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	HelpCircle,
	Home,
	Menu,
	Play,
	X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const courseStructure = [
	{
		id: 1,
		title: "Introduction to Web Security",
		lectures: [
			{
				id: 1,
				title: "What is Web Application Security?",
				type: "lecture",
				completed: true,
			},
			{
				id: 2,
				title: "Common Attack Vectors",
				type: "lecture",
				completed: false,
			},
			{
				id: 3,
				title: "Security Principles Quiz",
				type: "task",
				completed: false,
			},
		],
	},
	{
		id: 2,
		title: "OWASP Top 10",
		lectures: [
			{ id: 4, title: "Injection Attacks", type: "lecture", completed: false },
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
			{ id: 7, title: "OWASP Assessment", type: "task", completed: false },
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
			{ id: 9, title: "Input Validation", type: "lecture", completed: false },
			{ id: 10, title: "Final Assessment", type: "task", completed: false },
			{
				id: 11,
				title: "Advanced Security Concepts",
				type: "task",
				completed: false,
			},
		],
	},
];

export default function LearnPage({ params }: { params: { id: string } }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [currentLecture, setCurrentLecture] = useState(1);
	const [progress, setProgress] = useState<Record<number, boolean>>({
		1: true,
	});
	const [questionProgress, setQuestionProgress] = useState<
		Record<number, Record<number, boolean>>
	>({});

	const allLectures = courseStructure.flatMap((module) => module.lectures);
	const currentLectureData = allLectures.find(
		(lecture) => lecture.id === currentLecture,
	);
	const currentIndex = allLectures.findIndex(
		(lecture) => lecture.id === currentLecture,
	);

	const markComplete = (lectureId: number) => {
		setProgress((prev) => ({ ...prev, [lectureId]: true }));
	};

	const handleQuestionProgress = (
		taskId: number,
		questionId: number,
		hasAnswer: boolean,
	) => {
		setQuestionProgress((prev) => ({
			...prev,
			[taskId]: {
				...prev[taskId],
				[questionId]: hasAnswer,
			},
		}));
	};

	const getTaskProgress = (taskId: number) => {
		const taskQuestions = questionProgress[taskId] || {};
		const answeredCount = Object.values(taskQuestions).filter(Boolean).length;
		const totalQuestions = Object.keys(taskQuestions).length;
		return totalQuestions > 0 ? answeredCount / totalQuestions : 0;
	};

	const goToNext = () => {
		if (currentIndex < allLectures.length - 1) {
			setCurrentLecture(allLectures[currentIndex + 1].id);
		}
	};

	const goToPrevious = () => {
		if (currentIndex > 0) {
			setCurrentLecture(allLectures[currentIndex - 1].id);
		}
	};

	const handleLectureSelect = (lectureId: number) => {
		setCurrentLecture(lectureId);
		// Auto-close sidebar on mobile when selecting a lecture
		if (window.innerWidth < 640) {
			setSidebarOpen(false);
		}
	};

	return (
		<div className="flex min-h-screen bg-slate-950">
			{/* Backdrop for mobile */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 z-40 bg-black/50 sm:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<div
				className={`${sidebarOpen ? "w-full sm:w-80" : "w-0"} overflow-hidden border-slate-800 border-r bg-slate-900 transition-all duration-300 ${sidebarOpen ? "fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto" : ""}`}
			>
				<div className="flex items-center justify-between border-slate-800 border-b p-4">
					<h2 className="font-semibold text-white">Course Structure</h2>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSidebarOpen(false)}
						className="text-slate-400 hover:text-white sm:hidden"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="h-[calc(100vh-80px)] space-y-4 overflow-y-auto p-4">
					{courseStructure.map((module) => (
						<Collapsible key={module.id} defaultOpen>
							<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-3 transition-colors hover:bg-slate-700">
								<div className="flex items-center">
									<BookOpen className="mr-2 h-4 w-4 text-slate-400" />
									<span className="font-medium text-sm text-white">
										{module.title}
									</span>
								</div>
								<ChevronDown className="h-4 w-4 text-slate-400" />
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-2 space-y-1">
								{module.lectures.map((lecture) => {
									const taskProgress =
										lecture.type === "task" ? getTaskProgress(lecture.id) : 0;
									const isPartiallyComplete =
										lecture.type === "task" &&
										taskProgress > 0 &&
										taskProgress < 1;

									return (
										<button
											key={lecture.id}
											onClick={() => handleLectureSelect(lecture.id)}
											className={`flex w-full items-center rounded-lg p-2 text-left transition-colors ${
												currentLecture === lecture.id
													? "bg-red-600 text-white"
													: "text-slate-300 hover:bg-slate-700"
											}`}
										>
											<div className="flex flex-1 items-center">
												{progress[lecture.id] ? (
													<CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
												) : isPartiallyComplete ? (
													<div className="relative mr-2 h-4 w-4 flex-shrink-0">
														<div className="h-4 w-4 rounded-full border-2 border-slate-600" />
														<div
															className="absolute inset-0 rounded-full border-2 border-yellow-500"
															style={{
																clipPath: `polygon(0 0, ${taskProgress * 100}% 0, ${taskProgress * 100}% 100%, 0 100%)`,
															}}
														/>
													</div>
												) : (
													<div className="mr-2 h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-600" />
												)}
												{lecture.type === "lecture" ? (
													<Play className="mr-2 h-4 w-4 flex-shrink-0 text-blue-400" />
												) : (
													<HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 text-orange-400" />
												)}
												<span className="truncate text-sm">
													{lecture.title}
												</span>
											</div>
											{lecture.type === "task" &&
												taskProgress > 0 &&
												taskProgress < 1 && (
													<span className="ml-2 text-xs text-yellow-400">
														{Math.round(taskProgress * 100)}%
													</span>
												)}
										</button>
									);
								})}
							</CollapsibleContent>
						</Collapsible>
					))}
				</div>
			</div>

			{/* Main Content */}
			<div className="flex flex-1 flex-col">
				{/* Header */}
				<div className="flex items-center justify-between border-slate-800 border-b bg-slate-900 p-3 lg:p-4">
					<div className="flex min-w-0 flex-1 items-center">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(!sidebarOpen)}
							className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
						>
							{sidebarOpen ? (
								<X className="h-4 w-4 lg:h-5 lg:w-5" />
							) : (
								<Menu className="h-4 w-4 lg:h-5 lg:w-5" />
							)}
						</Button>
						<Link href="/">
							<Button
								variant="ghost"
								size="sm"
								className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
							>
								<Home className="h-4 w-4" />
							</Button>
						</Link>
						<h1 className="truncate font-semibold text-sm text-white lg:text-base">
							{currentLectureData?.title}
						</h1>
					</div>

					<div className="flex flex-shrink-0 items-center space-x-1 lg:space-x-2">
						<Button
							variant="outline"
							size="sm"
							onClick={goToPrevious}
							disabled={currentIndex === 0}
							className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
						>
							<ChevronLeft className="h-3 w-3 lg:mr-1 lg:h-4 lg:w-4" />
							<span className="hidden sm:inline">Previous</span>
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={goToNext}
							disabled={currentIndex === allLectures.length - 1}
							className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
						>
							<span className="hidden sm:inline">Next</span>
							<ChevronRight className="h-3 w-3 lg:ml-1 lg:h-4 lg:w-4" />
						</Button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 p-3 lg:p-6">
					{currentLectureData?.type === "lecture" ? (
						<LecturePlayer
							lecture={currentLectureData}
							onComplete={() => markComplete(currentLecture)}
							onNext={goToNext}
						/>
					) : (
						<TaskPlayer
							task={currentLectureData}
							onComplete={() => markComplete(currentLecture)}
							onNext={goToNext}
							onProgress={(questionId, hasAnswer) =>
								handleQuestionProgress(currentLecture, questionId, hasAnswer)
							}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
