"use client";

import {
	type PracticeDetailDTO,
	type PracticeSubmitResultDTO,
	type TaskSolution,
	getPractice,
	submitPractice,
} from "@/api/practice";
import Markdown from "@/components/markdown";
import { TaskPlayer } from "@/components/task-player";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { type UiAnswerPayload, buildTaskAnswer } from "@/lib/answers";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Turns a solved task's canonical solution into a value the TaskPlayer can
 * render read-only via its `initial` prop, so learners see the right answer.
 */
function solutionToInitial(
	solution: TaskSolution | null | undefined,
): string | string[] | undefined {
	if (!solution) return undefined;
	switch (solution.name) {
		case "single_choice":
			return solution.answer;
		case "multiple_choice":
			return solution.answers;
		case "short_text":
			return solution.answers[0];
		case "ordering":
			return solution.answer;
		default:
			return undefined;
	}
}

function verdictTone(verdict: string): { label: string; className: string } {
	switch (verdict) {
		case "full_score":
			return {
				label: "Correct",
				className: "border-green-700 bg-green-950/40 text-green-300",
			};
		case "partial_score":
			return {
				label: "Partially correct",
				className: "border-amber-700 bg-amber-950/40 text-amber-300",
			};
		case "incorrect":
			return {
				label: "Incorrect",
				className: "border-red-700 bg-red-950/40 text-red-300",
			};
		default:
			return {
				label: "Submitted",
				className: "border-slate-700 bg-slate-800/40 text-slate-300",
			};
	}
}

export default function PracticeRunner({ practiceId }: { practiceId: number }) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const [results, setResults] = useState<
		Record<number, PracticeSubmitResultDTO>
	>({});
	const latestAnswer = useRef<Record<number, UiAnswerPayload>>({});

	const query = useQuery<PracticeDetailDTO>({
		queryKey: ["practice", practiceId],
		queryFn: () => getPractice(practiceId),
		retry: false,
	});

	const handleSubmit = async (
		task: PracticeDetailDTO["tasks"][number]["task"],
	) => {
		const ui = latestAnswer.current[task.id];
		if (!ui) {
			toast({ description: t("no_answer") || "Please answer first" });
			return;
		}
		try {
			const answer = buildTaskAnswer(task, ui).answer;
			const res = await submitPractice(task.id, answer);
			setResults((prev) => ({ ...prev, [task.id]: res }));
		} catch (e) {
			toast({
				description:
					e instanceof Error ? e.message : t("save_failed") || "Failed",
			});
		}
	};

	if (query.isLoading) {
		return (
			<Card className="border-slate-800 bg-slate-900">
				<CardContent className="flex items-center gap-2 p-6 text-slate-400 text-sm">
					<Loader2 className="h-4 w-4 animate-spin" />{" "}
					{t("loading") || "Loading…"}
				</CardContent>
			</Card>
		);
	}

	const practice = query.data;
	if (query.isError || !practice) {
		return (
			<Card className="border-slate-800 bg-slate-900">
				<CardContent className="p-6 text-slate-400 text-sm">
					{t("practice_not_found") || "Practice not found"}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<div>
				<h1 className="font-bold text-2xl text-white">{practice.title}</h1>
				{practice.description ? (
					<Markdown
						content={practice.description}
						className="markdown-body mt-1 max-w-none text-slate-300 text-sm"
					/>
				) : null}
			</div>

			{practice.tasks.length === 0 ? (
				<Card className="border-slate-800 bg-slate-900">
					<CardContent className="p-6 text-slate-400 text-sm">
						{t("no_practice_tasks") || "No tasks in this practice yet."}
					</CardContent>
				</Card>
			) : (
				practice.tasks.map((item, idx) => {
					const result = results[item.task.id];
					const solved = result ? result.solved : item.solved;
					const tone = result ? verdictTone(result.verdict.verdict) : null;
					// Once solved, reveal the correct answer (read-only) so the
					// learner can remember what it was, even after a reload.
					const solutionInitial = solved
						? solutionToInitial(result?.solution ?? item.solution)
						: undefined;
					return (
						<div key={item.task.id} className="space-y-2">
							<div className="flex items-center justify-between text-slate-400 text-sm">
								<span>
									{t("task") || "Task"} {idx + 1} / {practice.tasks.length}
								</span>
								{solved ? (
									<span className="flex items-center gap-1 text-green-400">
										<CheckCircle2 className="h-4 w-4" />
										{t("solved") || "Solved"}
									</span>
								) : null}
							</div>

							<TaskPlayer
								key={item.task.id}
								task={item.task}
								previewMode={false}
								disabled={solved}
								isLast
								initial={solutionInitial}
								onAnswer={(payload) => {
									latestAnswer.current[item.task.id] = payload;
								}}
								onComplete={() => handleSubmit(item.task)}
								onNext={() => {}}
							/>

							{tone && !solved ? (
								<div className={`rounded-lg border p-3 ${tone.className}`}>
									<div className="flex items-center justify-between">
										<span className="font-semibold">{tone.label}</span>
										<span className="text-sm opacity-80">
											{t("attempts") || "Attempts"}: {result?.attempts}
										</span>
									</div>
								</div>
							) : null}
						</div>
					);
				})
			)}
		</div>
	);
}
