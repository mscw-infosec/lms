"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Maximize, Pause, Play, Volume2 } from "lucide-react";
import { useState } from "react";

interface LectureSummary {
	title: string;
}

interface LecturePlayerProps {
	lecture: LectureSummary;
	onComplete: () => void;
	onNext: () => void;
}

const transcript = `Welcome to Web Application Security Fundamentals. In this lecture, we'll explore what web application security means and why it's crucial in today's digital landscape.

Web application security refers to the protective measures and protocols that developers and organizations implement to safeguard web applications from various cyber threats and vulnerabilities.

As businesses increasingly rely on web applications for their operations, the attack surface has expanded significantly. Cybercriminals are constantly evolving their techniques to exploit vulnerabilities in web applications.

The consequences of inadequate web application security can be severe, including data breaches, financial losses, reputation damage, and legal implications.

Throughout this course, we'll cover the fundamental concepts, common vulnerabilities, and best practices for securing web applications effectively.`;

export function LecturePlayer({
	lecture,
	onComplete,
	onNext,
}: LecturePlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [completed, setCompleted] = useState(false);

	const handleComplete = () => {
		setCompleted(true);
		onComplete();
	};

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			{/* Video Player */}
			<Card className="border-slate-800 bg-slate-900">
				<CardContent className="p-0">
					<div className="relative flex aspect-video items-center justify-center rounded-t-lg bg-black">
						<div className="text-center">
							<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-600">
								{isPlaying ? (
									<Pause className="h-8 w-8 text-white" />
								) : (
									<Play className="ml-1 h-8 w-8 text-white" />
								)}
							</div>
							<p className="mb-2 text-lg text-white">{lecture.title}</p>
							<p className="text-slate-400">Duration: 15:30</p>
						</div>
					</div>

					{/* Video Controls */}
					<div className="rounded-b-lg bg-slate-800 p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsPlaying(!isPlaying)}
									className="text-white hover:bg-slate-700"
								>
									{isPlaying ? (
										<Pause className="h-5 w-5" />
									) : (
										<Play className="h-5 w-5" />
									)}
								</Button>
								<div className="flex items-center space-x-2">
									<Volume2 className="h-4 w-4 text-slate-400" />
									<div className="h-1 w-20 rounded-full bg-slate-600">
										<div className="h-full w-3/4 rounded-full bg-white" />
									</div>
								</div>
								<span className="text-slate-400 text-sm">5:23 / 15:30</span>
							</div>

							<div className="flex items-center space-x-2">
								<Button
									variant="ghost"
									size="sm"
									className="text-slate-400 hover:bg-slate-700 hover:text-white"
								>
									<Maximize className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Progress Bar */}
						<div className="mt-4">
							<div className="h-1 w-full rounded-full bg-slate-600">
								<div className="h-full w-1/3 rounded-full bg-red-600" />
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Tabs for Transcript and Notes */}
			<Tabs defaultValue="transcript" className="w-full">
				<TabsList className="grid w-full grid-cols-2 bg-slate-800">
					<TabsTrigger
						value="transcript"
						className="data-[state=active]:bg-slate-700"
					>
						Transcript
					</TabsTrigger>
					<TabsTrigger
						value="notes"
						className="data-[state=active]:bg-slate-700"
					>
						Notes
					</TabsTrigger>
				</TabsList>

				<TabsContent value="transcript">
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">Lecture Transcript</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="whitespace-pre-line text-slate-300 leading-relaxed">
								{transcript}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="notes">
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">Your Notes</CardTitle>
						</CardHeader>
						<CardContent>
							<textarea
								className="h-40 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-4 text-white placeholder-slate-400"
								placeholder="Take notes while watching the lecture..."
							/>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Complete Lecture */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					{completed && (
						<>
							<CheckCircle2 className="h-5 w-5 text-green-500" />
							<span className="text-green-500">Lecture completed!</span>
						</>
					)}
				</div>

				<div className="flex items-center space-x-3">
					{!completed && (
						<Button
							onClick={handleComplete}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							Mark as Complete
						</Button>
					)}
					<Button
						onClick={onNext}
						variant="outline"
						className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					>
						Next Lesson
					</Button>
				</div>
			</div>
		</div>
	);
}
