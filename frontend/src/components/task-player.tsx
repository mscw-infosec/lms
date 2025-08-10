"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, Award, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface TaskPlayerProps {
	task: { id: number };
	onComplete: () => void;
	onNext: () => void;
	onProgress?: (questionId: number, hasAnswer: boolean) => void;
}

type SingleQuestion = {
	id: number;
	type: "single";
	question: string;
	options: string[];
	correct: number;
};

type MultipleQuestion = {
	id: number;
	type: "multiple";
	question: string;
	options: string[];
	correct: number[];
};

type TextQuestion = {
	id: number;
	type: "text";
	question: string;
	correct: string;
	alternatives?: string[];
};

type OrderingQuestion = {
	id: number;
	type: "ordering";
	question: string;
	options: string[];
	correct: number[];
};

type MatchingQuestion = {
	id: number;
	type: "matching";
	question: string;
	leftItems: string[];
	rightItems: string[];
	correct: Record<number, number>;
};

type QuizQuestion =
	| SingleQuestion
	| MultipleQuestion
	| TextQuestion
	| OrderingQuestion
	| MatchingQuestion;

type Quiz = {
	title: string;
	description: string;
	questions: QuizQuestion[];
};

<<<<<<< HEAD
type AnswerValue = number | number[] | string | Record<number, number>;

=======
>>>>>>> a548896 (DEV-10: frontend api connect)
const quizData: Record<number, Quiz> = {
	3: {
		title: "Security Principles Quiz",
		description: "Test your understanding of fundamental security principles.",
		questions: [
			{
				id: 1,
				type: "single",
				question:
					"Which of the following is NOT one of the CIA triad principles?",
				options: [
					"Confidentiality",
					"Integrity",
					"Availability",
					"Accountability",
				],
				correct: 3,
			},
			{
				id: 2,
				type: "multiple",
				question:
					"Which of the following are part of the CIA triad? (Select all that apply)",
				options: [
					"Confidentiality",
					"Integrity",
					"Availability",
					"Authentication",
				],
				correct: [0, 1, 2],
			},
		],
	},
	7: {
		title: "OWASP Assessment",
		description: "Comprehensive assessment of OWASP Top 10 knowledge.",
		questions: [
			{
				id: 1,
				type: "single",
				question:
					"Which of the following is the most effective way to prevent SQL injection?",
				options: [
					"Input validation only",
					"Using parameterized queries/prepared statements",
					"Escaping special characters",
					"Using stored procedures only",
				],
				correct: 1,
			},
			{
				id: 2,
				type: "single",
				question: "What does the principle of 'least privilege' mean?",
				options: [
					"Users should have maximum access to all systems",
					"Users should only have the minimum access necessary to perform their job",
					"All users should have the same level of access",
					"Access should be granted based on seniority",
				],
				correct: 1,
			},
			{
				id: 3,
				type: "multiple",
				question:
					"Which of the following are effective data protection strategies? (Select all that apply)",
				options: [
					"Encryption at rest",
					"Encryption in transit",
					"Access logging",
					"Storing passwords in plain text",
				],
				correct: [0, 1, 2],
			},
		],
	},
	10: {
		title: "Final Assessment",
		description: "Comprehensive assessment of course material.",
		questions: [
			{
				id: 1,
				type: "single",
				question: "Which practice helps prevent buffer overflow attacks?",
				options: [
					"Using dynamic memory allocation",
					"Bounds checking and input validation",
					"Using global variables",
					"Disabling compiler warnings",
				],
				correct: 1,
			},
			{
				id: 2,
				type: "single",
				question: "When should input validation be performed?",
				options: [
					"Only on the client side",
					"Only on the server side",
					"On both client and server side",
					"Only when storing data",
				],
				correct: 2,
			},
			{
				id: 3,
				type: "multiple",
				question:
					"Which of the following are key components of a comprehensive security strategy? (Select all that apply)",
				options: [
					"Defense in depth",
					"Regular security audits",
					"User training",
					"Ignoring minor vulnerabilities",
				],
				correct: [0, 1, 2],
			},
		],
	},
	11: {
		title: "Advanced Security Concepts",
		description: "Test your knowledge of advanced security concepts.",
		questions: [
			{
				id: 1,
				type: "text",
				question: "What does CSRF stand for? (Enter the full term)",
				correct: "Cross-Site Request Forgery",
				alternatives: [
					"cross-site request forgery",
					"Cross Site Request Forgery",
					"cross site request forgery",
				],
			},
			{
				id: 2,
				type: "ordering",
				question: "Arrange these security testing phases in the correct order:",
				options: [
					"Vulnerability Assessment",
					"Reconnaissance",
					"Exploitation",
					"Post-Exploitation",
				],
				correct: [1, 0, 2, 3], // indices in correct order
			},
			{
				id: 3,
				type: "matching",
				question: "Match each vulnerability type with its primary mitigation:",
				leftItems: ["SQL Injection", "XSS", "CSRF", "Buffer Overflow"],
				rightItems: [
					"Input Validation",
					"Output Encoding",
					"CSRF Tokens",
					"Parameterized Queries",
				],
				correct: { 0: 3, 1: 1, 2: 2, 3: 0 }, // left index: right index
			},
		],
	},
};

export function TaskPlayer({
	task,
	onComplete,
	onNext,
	onProgress,
}: TaskPlayerProps) {
	const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
	const [submitted, setSubmitted] = useState(false);
	const [score, setScore] = useState(0);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

	const quiz = quizData[task.id as keyof typeof quizData];

	if (!quiz) {
		return (
			<div className="mx-auto max-w-4xl">
				<Card className="border-slate-800 bg-slate-900">
					<CardContent className="p-8 text-center">
						<AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
						<h2 className="mb-2 font-semibold text-white text-xl">
							Task Not Available
						</h2>
						<p className="text-slate-400">
							This task is currently being prepared.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

<<<<<<< HEAD
	const currentQuestion = quiz.questions[currentQuestionIndex];
	if (!currentQuestion) {
		return null;
	}
=======
	const currentQuestion = quiz.questions[currentQuestionIndex]!;
>>>>>>> a548896 (DEV-10: frontend api connect)
	const totalQuestions = quiz.questions.length;

	const handleSingleAnswer = (questionId: number, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionId]: Number.parseInt(value) }));
		onProgress?.(questionId, true);
	};

	const handleMultipleAnswer = (
		questionId: number,
		optionIndex: number,
		checked: boolean,
	) => {
		setAnswers((prev) => {
			const current = Array.isArray(prev[questionId])
				? (prev[questionId] as number[])
				: [];
			if (checked) {
				const newAnswers = { ...prev, [questionId]: [...current, optionIndex] };
				onProgress?.(questionId, true);
				return newAnswers;
			}
			const newArray = current.filter((i: number) => i !== optionIndex);
			const newAnswers = { ...prev, [questionId]: newArray };
			onProgress?.(questionId, newArray.length > 0);
			return newAnswers;
		});
	};

	const handleSubmit = () => {
		let correctAnswers = 0;

		for (const question of quiz.questions) {
			const userAnswer = answers[question.id];
			let isCorrect = false;

			if (question.type === "single") {
				isCorrect = userAnswer === (question as SingleQuestion).correct;
			} else if (question.type === "multiple") {
				const correctArray = (question as MultipleQuestion).correct;
<<<<<<< HEAD
				const userArray = (
					Array.isArray(userAnswer) ? userAnswer : []
				) as number[];
=======
				const userArray = userAnswer || [];
>>>>>>> a548896 (DEV-10: frontend api connect)
				isCorrect =
					correctArray.length === userArray.length &&
					correctArray.every((val: number) => userArray.includes(val));
			} else if (question.type === "text") {
<<<<<<< HEAD
				const userText = String((userAnswer as string | undefined) ?? "")
					.toLowerCase()
					.trim();
				const correctText = String(
					(question as TextQuestion).correct ?? "",
				).toLowerCase();
				const alternatives = (question as TextQuestion).alternatives || [];
				isCorrect =
					userText === correctText ||
					alternatives.some(
						(alt: string) => String(alt).toLowerCase() === userText,
					);
			} else if (question.type === "ordering") {
				const userOrder = (
					Array.isArray(userAnswer) ? userAnswer : []
				) as number[];
				const correctOrder = (question as OrderingQuestion).correct;
				isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);
			} else if (question.type === "matching") {
				const userMatches = (
					userAnswer && typeof userAnswer === "object" ? userAnswer : {}
				) as Record<number, number>;
=======
				const userText = String(userAnswer ?? "").toLowerCase().trim();
				const correctText = String((question as TextQuestion).correct ?? "").toLowerCase();
				const alternatives = (question as TextQuestion).alternatives || [];
				isCorrect =
					userText === correctText ||
					alternatives.some((alt: string) => String(alt).toLowerCase() === userText);
			} else if (question.type === "ordering") {
				const userOrder = userAnswer || [];
				const correctOrder = (question as OrderingQuestion).correct;
				isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);
			} else if (question.type === "matching") {
				const userMatches = userAnswer || {};
>>>>>>> a548896 (DEV-10: frontend api connect)
				const correctMatches = (question as MatchingQuestion).correct;
				isCorrect =
					JSON.stringify(userMatches) === JSON.stringify(correctMatches);
			}

			if (isCorrect) correctAnswers++;
		}

		const finalScore = Math.round((correctAnswers / totalQuestions) * 100);
		setScore(finalScore);
		setSubmitted(true);

		if (finalScore >= 70) {
			onComplete();
		}
	};

	const getQuestionResult = (questionId: number) => {
		if (!submitted) return null;

		const question = quiz.questions.find((q) => q.id === questionId);
		if (!question) return false;

		const userAnswer = answers[question.id];

		if (question.type === "single") {
			return userAnswer === (question as SingleQuestion).correct;
		}
		if (question.type === "multiple") {
			const correctArray = (question as MultipleQuestion).correct;
<<<<<<< HEAD
			const userArray = (
				Array.isArray(userAnswer) ? userAnswer : []
			) as number[];
=======
			const userArray = userAnswer || [];
>>>>>>> a548896 (DEV-10: frontend api connect)
			return (
				correctArray.length === userArray.length &&
				correctArray.every((val: number) => userArray.includes(val))
			);
		}
		if (question.type === "text") {
<<<<<<< HEAD
			const userText = String((userAnswer as string | undefined) ?? "")
				.toLowerCase()
				.trim();
			const correctText = String(
				(question as TextQuestion).correct ?? "",
			).toLowerCase();
			const alternatives = (question as TextQuestion).alternatives || [];
			return (
				userText === correctText ||
				alternatives.some(
					(alt: string) => String(alt).toLowerCase() === userText,
				)
			);
		}
		if (question.type === "ordering") {
			const userOrder = (
				Array.isArray(userAnswer) ? userAnswer : []
			) as number[];
=======
			const userText = String(userAnswer ?? "").toLowerCase().trim();
			const correctText = String((question as TextQuestion).correct ?? "").toLowerCase();
			const alternatives = (question as TextQuestion).alternatives || [];
			return (
				userText === correctText ||
				alternatives.some((alt: string) => String(alt).toLowerCase() === userText)
			);
		}
		if (question.type === "ordering") {
			const userOrder = userAnswer || [];
>>>>>>> a548896 (DEV-10: frontend api connect)
			const correctOrder = (question as OrderingQuestion).correct;
			return JSON.stringify(userOrder) === JSON.stringify(correctOrder);
		}
		if (question.type === "matching") {
<<<<<<< HEAD
			const userMatches = (
				userAnswer && typeof userAnswer === "object" ? userAnswer : {}
			) as Record<number, number>;
=======
			const userMatches = userAnswer || {};
>>>>>>> a548896 (DEV-10: frontend api connect)
			const correctMatches = (question as MatchingQuestion).correct;
			return JSON.stringify(userMatches) === JSON.stringify(correctMatches);
		}

		return false;
	};

	const goToNextQuestion = () => {
		if (currentQuestionIndex < totalQuestions - 1) {
			setCurrentQuestionIndex(currentQuestionIndex + 1);
		}
	};

	const goToPreviousQuestion = () => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(currentQuestionIndex - 1);
		}
	};

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			{/* Task Header */}
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="text-2xl text-white">{quiz.title}</CardTitle>
					<p className="text-slate-400">{quiz.description}</p>
					<div className="mt-4 flex items-center justify-between">
						<p className="text-slate-500 text-sm">
							Question {currentQuestionIndex + 1} of {totalQuestions}
						</p>
						<div className="flex space-x-1">
							{quiz.questions.map((q, index) => (
								<div
									key={q.id}
									className={`h-2 w-2 rounded-full ${
										index === currentQuestionIndex
											? "bg-red-600"
<<<<<<< HEAD
											: answers[q.id ?? -1] !== undefined
=======
											: answers[quiz.questions[index]?.id ?? -1] !== undefined
>>>>>>> a548896 (DEV-10: frontend api connect)
												? "bg-slate-600"
												: "bg-slate-700"
									}`}
								/>
							))}
						</div>
					</div>
				</CardHeader>
			</Card>

			{/* Question */}
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<div className="flex items-start justify-between">
						<CardTitle className="text-lg text-white">
							Question {currentQuestionIndex + 1}
						</CardTitle>
						{submitted && (
							<div
								className={`flex items-center ${getQuestionResult(currentQuestion.id) ? "text-green-500" : "text-red-500"}`}
							>
								<CheckCircle2 className="mr-1 h-5 w-5" />
								{getQuestionResult(currentQuestion.id)
									? "Correct"
									: "Incorrect"}
							</div>
						)}
					</div>
					<p className="text-slate-300">{currentQuestion.question}</p>
				</CardHeader>
				<CardContent>
					{currentQuestion.type === "single" ? (
						<RadioGroup
							value={answers[currentQuestion.id]?.toString() || ""}
							onValueChange={(value) =>
								handleSingleAnswer(currentQuestion.id, value)
							}
							disabled={submitted}
						>
							{currentQuestion.options.map((option, optionIndex) => (
								<div
									key={`${currentQuestion.id}-single-${String(option)}`}
									className="flex items-center space-x-2"
								>
									<RadioGroupItem
										value={optionIndex.toString()}
										id={`q${currentQuestion.id}-${optionIndex}`}
										className="border-slate-600 text-red-600"
									/>
									<Label
										htmlFor={`q${currentQuestion.id}-${optionIndex}`}
										className={`cursor-pointer text-slate-300 ${
<<<<<<< HEAD
											submitted &&
											optionIndex ===
												(currentQuestion as SingleQuestion).correct
=======
											submitted && optionIndex === (currentQuestion as SingleQuestion).correct
>>>>>>> a548896 (DEV-10: frontend api connect)
												? "font-medium text-green-400"
												: ""
											} ${
											submitted &&
											answers[currentQuestion.id] === optionIndex &&
<<<<<<< HEAD
											optionIndex !==
												(currentQuestion as SingleQuestion).correct
=======
											optionIndex !== (currentQuestion as SingleQuestion).correct
>>>>>>> a548896 (DEV-10: frontend api connect)
												? "text-red-400"
												: ""
										}`}
									>
										{option}
									</Label>
								</div>
							))}
						</RadioGroup>
					) : currentQuestion.type === "multiple" ? (
						<div className="space-y-3">
							{currentQuestion.options.map((option, optionIndex) => (
								<div
									key={`${currentQuestion.id}-multiple-${String(option)}`}
									className="flex items-center space-x-2"
								>
									<Checkbox
										id={`q${currentQuestion.id}-${optionIndex}`}
										checked={(Array.isArray(answers[currentQuestion.id])
											? (answers[currentQuestion.id] as number[])
											: []
										).includes(optionIndex)}
										onCheckedChange={(checked) =>
											handleMultipleAnswer(
												currentQuestion.id,
												optionIndex,
												checked as boolean,
											)
										}
										disabled={submitted}
										className="border-slate-600 data-[state=checked]:bg-red-600"
									/>
									<Label
										htmlFor={`q${currentQuestion.id}-${optionIndex}`}
										className={`cursor-pointer text-slate-300 ${
											submitted &&
											(currentQuestion as MultipleQuestion).correct.includes(
												optionIndex,
											)
												? "font-medium text-green-400"
												: ""
										}`}
									>
										{option}
									</Label>
								</div>
							))}
						</div>
					) : currentQuestion.type === "text" ? (
						<div className="space-y-3">
							<input
								type="text"
								value={String(answers[currentQuestion.id] ?? "")}
								onChange={(e) => {
									setAnswers((prev) => ({
										...prev,
										[currentQuestion.id]: e.target.value,
									}));
									onProgress?.(
										currentQuestion.id,
										e.target.value.trim().length > 0,
									);
								}}
								disabled={submitted}
								className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-400"
								placeholder="Enter your answer..."
							/>
							{submitted && (
								<p
									className={`text-sm ${getQuestionResult(currentQuestion.id) ? "text-green-400" : "text-red-400"}`}
								>
									Correct answer: {(currentQuestion as TextQuestion).correct}
								</p>
							)}
						</div>
					) : currentQuestion.type === "ordering" ? (
						<div className="space-y-3">
							<p className="mb-4 text-slate-400 text-sm">
								Drag and drop to reorder:
							</p>
							<div className="space-y-2">
<<<<<<< HEAD
								{(Array.isArray(answers[currentQuestion.id])
									? (answers[currentQuestion.id] as number[])
									: currentQuestion.options.map((_, i) => i)
=======
								{(
									answers[currentQuestion.id] ||
									currentQuestion.options.map((_, i) => i)
>>>>>>> a548896 (DEV-10: frontend api connect)
								).map((itemIndex: number, position: number) => (
									<div
										key={itemIndex}
										className={`cursor-move rounded-lg border border-slate-700 bg-slate-800 p-3 ${
<<<<<<< HEAD
											submitted &&
											(currentQuestion as OrderingQuestion).correct[
												position
											] === itemIndex
												? "border-green-500"
												: ""
										} ${
											submitted &&
											(currentQuestion as OrderingQuestion).correct[
												position
											] !== itemIndex
												? "border-red-500"
												: ""
=======
											submitted && (currentQuestion as OrderingQuestion).correct[position] === itemIndex
												? "border-green-500"
												: ""
											} ${
											submitted && (currentQuestion as OrderingQuestion).correct[position] !== itemIndex ? "border-red-500" : ""
>>>>>>> a548896 (DEV-10: frontend api connect)
										}`}
									>
										<span className="text-slate-300">
											{position + 1}. {currentQuestion.options[itemIndex]}
										</span>
									</div>
								))}
							</div>
						</div>
					) : currentQuestion.type === "matching" ? (
						<div className="space-y-4">
							<p className="mb-4 text-slate-400 text-sm">
								Match items from left column to right column:
							</p>
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<div className="space-y-2">
									<h4 className="font-medium text-slate-300">
										Items to match:
									</h4>
<<<<<<< HEAD
									{(currentQuestion as MatchingQuestion).leftItems.map(
										(item) => (
											<div
												key={`${currentQuestion.id}-left-${String(item)}`}
												className="rounded-lg border border-slate-700 bg-slate-800 p-3"
											>
												<span className="text-slate-300">{item}</span>
											</div>
										),
									)}
								</div>
								<div className="space-y-2">
									<h4 className="font-medium text-slate-300">Match with:</h4>
									{(currentQuestion as MatchingQuestion).rightItems.map(
										(item, rightIndex) => (
											<button
												type="button"
												key={`${currentQuestion.id}-right-${String(item)}`}
												onClick={() => {
													// Simple matching logic - in a real app, you'd implement proper drag & drop
													const currentMatches =
														answers[currentQuestion.id] &&
														typeof answers[currentQuestion.id] === "object" &&
														!Array.isArray(answers[currentQuestion.id])
															? (answers[currentQuestion.id] as Record<
																	number,
																	number
																>)
															: {};
													const newMatches = {
														...currentMatches,
														[0]: rightIndex,
													}; // Simplified for demo
													setAnswers((prev) => ({
														...prev,
														[currentQuestion.id]: newMatches,
													}));
													onProgress?.(
														currentQuestion.id,
														Object.keys(newMatches).length > 0,
													);
												}}
												disabled={submitted}
												className={`w-full rounded-lg border border-slate-700 p-3 text-left transition-colors ${
													(
														answers[currentQuestion.id] as
															| Record<number, number>
															| undefined
													)?.[0] === rightIndex
														? "bg-red-600 text-white"
														: "bg-slate-800 text-slate-300 hover:bg-slate-700"
												}`}
											>
												{item}
											</button>
										),
									)}
=======
									{(currentQuestion as MatchingQuestion).leftItems.map((item, leftIndex) => (
										<div
											key={leftIndex}
											className="rounded-lg border border-slate-700 bg-slate-800 p-3"
										>
											<span className="text-slate-300">{item}</span>
										</div>
									))}
								</div>
								<div className="space-y-2">
									<h4 className="font-medium text-slate-300">Match with:</h4>
									{(currentQuestion as MatchingQuestion).rightItems.map((item, rightIndex) => (
										<button
											key={rightIndex}
											onClick={() => {
												// Simple matching logic - in a real app, you'd implement proper drag & drop
												const currentMatches =
													answers[currentQuestion.id] || {};
												const newMatches = {
													...currentMatches,
													[0]: rightIndex,
												}; // Simplified for demo
												setAnswers((prev) => ({
													...prev,
													[currentQuestion.id]: newMatches,
												}));
												onProgress?.(
													currentQuestion.id,
													Object.keys(newMatches).length > 0,
												);
											}}
											disabled={submitted}
											className={`w-full rounded-lg border border-slate-700 p-3 text-left transition-colors ${
												answers[currentQuestion.id]?.[0] === rightIndex
													? "bg-red-600 text-white"
													: "bg-slate-800 text-slate-300 hover:bg-slate-700"
											}`}
										>
											{item}
										</button>
									))}
>>>>>>> a548896 (DEV-10: frontend api connect)
								</div>
							</div>
						</div>
					) : null}
				</CardContent>
			</Card>

			{/* Question Navigation */}
			{!submitted && totalQuestions > 1 && (
				<div className="flex items-center justify-between">
					<Button
						onClick={goToPreviousQuestion}
						disabled={currentQuestionIndex === 0}
						variant="outline"
						className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					>
						Previous Question
					</Button>
					<Button
						onClick={goToNextQuestion}
						disabled={currentQuestionIndex === totalQuestions - 1}
						variant="outline"
						className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					>
						Next Question
					</Button>
				</div>
			)}

			{/* Results */}
			{submitted && (
				<Card className="border-slate-800 bg-slate-900">
					<CardContent className="p-6 text-center">
						<Award
							className={`mx-auto mb-4 h-12 w-12 ${score >= 70 ? "text-green-500" : "text-yellow-500"}`}
						/>
						<h3 className="mb-2 font-semibold text-white text-xl">
							Quiz Complete!
						</h3>
						<p className="mb-2 font-bold text-2xl">
							<span
								className={score >= 70 ? "text-green-500" : "text-yellow-500"}
							>
								{score}%
							</span>
						</p>
						<p className="mb-4 text-slate-400">
							You got {Math.round((score / 100) * totalQuestions)} out of {totalQuestions} questions correct.
						</p>
						<p className="mb-4 text-slate-400">
							{score >= 70
								? "Great job! You can proceed to the next lesson."
								: "Please review the material and try again."}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Actions */}
			<div className="flex items-center justify-between">
				<div />
				<div className="flex items-center space-x-3">
					{!submitted ? (
						<Button
							onClick={handleSubmit}
							className="bg-red-600 hover:bg-red-700"
							disabled={quiz.questions.some((q) => answers[q.id] === undefined)}
						>
							Submit Quiz
						</Button>
					) : (
						<>
							{score < 70 && (
								<Button
									onClick={() => {
										setSubmitted(false);
										setAnswers({});
										setScore(0);
										setCurrentQuestionIndex(0);
									}}
									variant="outline"
									className="border-slate-700 text-slate-300 hover:bg-slate-800"
								>
									Try Again
								</Button>
							)}
							<Button
								onClick={onNext}
								variant="outline"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								Next Lesson
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
