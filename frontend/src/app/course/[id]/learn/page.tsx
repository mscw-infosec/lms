"use client";

import { getCourseById, getCourseTopics } from "@/api/courses";
import {
	type ExamAttempt,
	type ExamDTO,
	type PublicTaskDTO,
	getTopicExams,
	getUserExamAttempts,
	patchAttempt,
} from "@/api/exam";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import Markdown from "@/components/markdown";
import { TaskPlayer } from "@/components/task-player";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { useAttempt } from "@/hooks/use-attempt";
import { buildTaskAnswer } from "@/lib/answers";
import type { UiAnswerPayload } from "@/lib/answers";
import { useUserStore } from "@/store/user";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	BookOpen,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	HelpCircle,
	Menu,
	Play,
	X,
} from "lucide-react";
import { Info } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type TaskConfig = {
	name?: string;
	options?: string[];
	items?: string[];
};

export default function LearnPage() {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const params = useParams<{ id: string }>();
	const courseId = Number.parseInt(String(params.id));
	const { user } = useUserStore();
	const isStaff = user?.role === "Teacher" || user?.role === "Admin";

	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const [selectedExam, setSelectedExam] = useState<ExamDTO | null>(null);
	const [pendingExam, setPendingExam] = useState<ExamDTO | null>(null);
	const [reviewMode, setReviewMode] = useState(false);
	const [selectedReviewAttemptId, setSelectedReviewAttemptId] = useState<
		string | null
	>(null);

	const {
		attempt,
		isPreview,
		tasks,
		loading,
		taskIndex,
		setTaskIndex,
		start,
		stop,
		starting,
		stopping,
		patchProgress,
		patching,
		noMoreAttempts,
		flushNow,
		refresh,
		attemptsLeft,
		ranOut,
	} = useAttempt(selectedExam?.id ?? null, isStaff, selectedExam?.tries_count);

	const unlimitedAttempts = (selectedExam?.tries_count ?? -1) === 0;
	const ranOutEffective = !unlimitedAttempts && ranOut === true;

	const latestAnswersRef = useRef<
		Record<number, ReturnType<typeof buildTaskAnswer> | null>
	>({});

	const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());

	useEffect(() => {
		const next = new Set<number>();
		try {
			const answers = attempt?.answer_data?.answers;
			if (answers && typeof answers === "object") {
				for (const k of Object.keys(answers)) {
					const id = Number(k);
					if (Number.isFinite(id)) next.add(id);
				}
			}
		} catch {}
		setSubmittedIds(next);
	}, [attempt?.answer_data?.answers]);

	const submitBufferedForTask = (taskId: number) => {
		if (!attempt || !attempt.active) return;
		const dto = latestAnswersRef.current[taskId];
		if (dto) {
			patchProgress(dto);
			setSubmittedIds((prev) => new Set(prev).add(taskId));
		}
	};

	const submitAllBuffered = useCallback(() => {
		if (!attempt || !attempt.active) return;
		const entries = Object.entries(latestAnswersRef.current);
		for (const [key, dto] of entries) {
			if (dto) patchProgress(dto);
		}
	}, [attempt, patchProgress]);

	// ----- Attempt countdown timer and periodic sync -----
	const [remainingSec, setRemainingSec] = useState<number | null>(null);
	const finishTriggeredRef = useRef(false);

	const computeRemaining = useMemo(() => {
		return () => {
			if (!attempt?.active || !selectedExam?.duration) return null;
			try {
				const started = new Date(attempt.started_at).getTime();
				// duration is stored in seconds; convert to milliseconds
				const endAt = started + Number(selectedExam.duration) * 1_000;
				const secs = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
				return secs;
			} catch {
				return null;
			}
		};
	}, [attempt?.active, attempt?.started_at, selectedExam?.duration]);

	useEffect(() => {
		finishTriggeredRef.current = false;
		if (!attempt?.active || !selectedExam?.duration) {
			setRemainingSec(null);
			return;
		}
		setRemainingSec(computeRemaining());
		const tick = window.setInterval(() => {
			setRemainingSec(computeRemaining());
		}, 1000);
		return () => {
			window.clearInterval(tick);
		};
	}, [attempt?.active, selectedExam?.duration, computeRemaining]);

	useEffect(() => {
		if (!attempt?.active) return;
		const iv = window.setInterval(() => {
			refresh();
		}, 60_000);
		return () => window.clearInterval(iv);
	}, [attempt?.active, refresh]);

	useEffect(() => {
		if (!attempt?.active) return;
		if (
			typeof remainingSec === "number" &&
			remainingSec <= 0 &&
			!finishTriggeredRef.current
		) {
			finishTriggeredRef.current = true;
			(async () => {
				try {
					submitAllBuffered();
					await flushNow();
				} finally {
					stop();
					setTimeout(() => {
						refresh();
					}, 300);
				}
			})();
		}
	}, [
		attempt?.active,
		remainingSec,
		flushNow,
		stop,
		refresh,
		submitAllBuffered,
	]);

	const formatTime = (secs: number) => {
		if (!Number.isFinite(secs)) return "--:--";
		const s = Math.max(0, Math.floor(secs));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const r = s % 60;
		if (h > 0) {
			return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
		}
		return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
	};

	const topicsQuery = useQuery({
		queryKey: ["course-topics", courseId],
		queryFn: async () => {
			const data = await getCourseTopics(courseId);
			return data.sort((a, b) => a.order_index - b.order_index);
		},
		enabled: Number.isFinite(courseId),
		retry: false,
	});

	const attemptsListQuery = useQuery({
		queryKey: [
			"exam",
			selectedExam ? String(selectedExam.id) : null,
			"attempts-list",
		],
		queryFn: async () => {
			if (!selectedExam) throw new Error("no examId");
			return await getUserExamAttempts(String(selectedExam.id));
		},
		enabled: !!selectedExam,
		retry: false,
	});

	const examsByTopicQuery = useQuery({
		queryKey: ["topics-exams", topicsQuery.data?.map((t) => t.id) ?? []],
		queryFn: async () => {
			const topics = topicsQuery.data ?? [];
			const entries = await Promise.all(
				topics.map(async (topic) => {
					const exams = await getTopicExams(topic.id).catch(() => []);
					return [topic.id, exams as ExamDTO[]] as const;
				}),
			);
			return Object.fromEntries(entries) as Record<number, ExamDTO[]>;
		},
		enabled: topicsQuery.isSuccess,
		retry: false,
	});

	const topicsCount = (topicsQuery.data ?? []).length;
	const examsCount = Object.values(examsByTopicQuery.data ?? {}).reduce(
		(acc, arr) => acc + arr.length,
		0,
	);

	const courseQuery = useQuery({
		queryKey: ["course", courseId],
		queryFn: () => getCourseById(courseId),
		enabled: Number.isFinite(courseId),
		retry: false,
	});

	const canPrev = taskIndex > 0;
	const canNext = taskIndex < (tasks.length || 0) - 1;

	const switching = (pendingExam?.id ?? null) !== (selectedExam?.id ?? null);

	const handleStart = () => {
		if (!selectedExam) return;
		setReviewMode(false);
		start();
	};

	/* biome-ignore lint/correctness/useExhaustiveDependencies: we intentionally re-run when selected exam changes */
	useEffect(() => {
		setReviewMode(false);
		setSelectedReviewAttemptId(null);
		latestAnswersRef.current = {};
	}, [selectedExam?.id]);

	useEffect(() => {
		if (isStaff) {
			setReviewMode(false);
			return;
		}
		if (attempt?.active) {
			setReviewMode(false);
			return;
		}
	}, [isStaff, attempt?.active]);

	const sortedAttempts: ExamAttempt[] = useMemo(() => {
		const list = attemptsListQuery.data?.attempts ?? [];
		return [...list].sort(
			(a, b) =>
				new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
		);
	}, [attemptsListQuery.data?.attempts]);

	useEffect(() => {
		if (!reviewMode) return;
		if (!selectedReviewAttemptId && sortedAttempts[0]) {
			setSelectedReviewAttemptId(String(sortedAttempts[0].id));
		}
	}, [reviewMode, selectedReviewAttemptId, sortedAttempts]);

	const reviewAttempt: ExamAttempt | null = useMemo(() => {
		if (!reviewMode) return null;
		if (!selectedReviewAttemptId) return null;
		return (
			sortedAttempts.find((a) => String(a.id) === selectedReviewAttemptId) ??
			null
		);
	}, [reviewMode, selectedReviewAttemptId, sortedAttempts]);

	const hasViewableAttempts = useMemo(() => {
		try {
			return (sortedAttempts ?? []).some(
				(a) => !!a?.scoring_data?.show_results,
			);
		} catch {
			return false;
		}
	}, [sortedAttempts]);

	const answersByTaskId: Record<number, unknown> = (() => {
		const a = (reviewAttempt ?? attempt)?.answer_data?.answers;
		if (!a) return {};
		const out: Record<number, unknown> = {};
		for (const [k, v] of Object.entries(a)) {
			const id = Number(k);
			if (Number.isFinite(id)) out[id] = v;
		}
		return out;
	})();

	const verdictsByTaskId: Record<number, string | undefined> = (() => {
		const r = (reviewAttempt ?? attempt)?.scoring_data?.results;
		if (!r) return {};
		const out: Record<number, string> = {};
		for (const [k, v] of Object.entries(r)) {
			const id = Number(k);
			if (Number.isFinite(id) && v && typeof v.verdict === "string")
				out[id] = v.verdict;
		}
		return out;
	})();

	function renderReadOnlyTask(task: PublicTaskDTO) {
		const cfg = (task as { configuration?: TaskConfig }).configuration ?? {};
		const cfgName: string | undefined =
			typeof (cfg as TaskConfig).name === "string"
				? (cfg as TaskConfig).name
				: undefined;
		const ans = answersByTaskId[task.id];
		const verdict = verdictsByTaskId[task.id];
		const verdictLabel =
			verdict === "full_score"
				? (t("correct") ?? "Correct")
				: verdict === "partial_score"
					? (t("partially_correct") ?? "Partially correct")
					: verdict === "incorrect"
						? (t("incorrect") ?? "Incorrect")
						: verdict === "on_review"
							? (t("on_review") ?? "On review")
							: undefined;
		const tone =
			verdict === "full_score"
				? "green"
				: verdict === "incorrect"
					? "red"
					: verdict === "on_review" || verdict === "partial_score"
						? "amber"
						: "slate";
		const border =
			tone === "green"
				? "border-green-700"
				: tone === "red"
					? "border-red-700"
					: tone === "amber"
						? "border-amber-700"
						: "border-slate-800";
		const badgeBg =
			tone === "green"
				? "bg-green-600"
				: tone === "red"
					? "bg-red-600"
					: tone === "amber"
						? "bg-amber-600"
						: "bg-slate-700";
		return (
			<Card key={task.id} className={`relative border bg-slate-900 ${border}`}>
				{verdictLabel ? (
					<div
						className={`absolute top-3 right-3 rounded-full px-2.5 py-1 font-medium text-white text-xs ${badgeBg}`}
					>
						{verdictLabel}
					</div>
				) : null}
				<CardHeader>
					<CardTitle className="text-2xl text-white">{task.title}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{task.description ? <Markdown content={task.description} /> : null}
					<div className="text-slate-400 text-xs">
						{task.points ?? 0} {t("points") ?? "points"} · {cfgName ?? "task"}
					</div>

					{cfgName === "single_choice" &&
						Array.isArray((cfg as TaskConfig)?.options) &&
						(() => {
							const ansRaw = (ans as { answer?: unknown })?.answer;
							const correctIdxRaw = (
								task.configuration as { correct?: unknown }
							)?.correct;
							const correctIdx =
								typeof correctIdxRaw === "number" ? correctIdxRaw : undefined;
							let selectedIdx: number | undefined = undefined;
							let selectedLabel: string | undefined = undefined;
							if (typeof ansRaw === "number") {
								if (
									Number.isFinite(ansRaw) &&
									Array.isArray((cfg as TaskConfig).options)
								) {
									selectedIdx = ansRaw;
									selectedLabel =
										(cfg as TaskConfig).options?.[ansRaw] ?? String(ansRaw);
								}
							} else if (typeof ansRaw === "string") {
								const maybeNum = Number(ansRaw);
								if (
									Number.isFinite(maybeNum) &&
									Array.isArray((cfg as TaskConfig).options)
								) {
									selectedIdx = maybeNum;
									selectedLabel =
										(cfg as TaskConfig).options?.[maybeNum] ?? String(ansRaw);
								} else {
									selectedLabel = ansRaw;
									if (Array.isArray((cfg as TaskConfig).options)) {
										const i = ((cfg as TaskConfig).options as string[]).indexOf(
											ansRaw,
										);
										if (i >= 0) selectedIdx = i;
									}
								}
							}

							const effectiveCorrectIdx: number | undefined =
								typeof correctIdx === "number"
									? correctIdx
									: verdict === "full_score" && typeof selectedIdx === "number"
										? selectedIdx
										: undefined;
							return (
								<div className="space-y-2">
									{((cfg as TaskConfig).options as string[]).map(
										(label, idx) => {
											const isSelected =
												typeof selectedIdx === "number" && selectedIdx === idx;
											const isCorrect =
												typeof effectiveCorrectIdx === "number" &&
												effectiveCorrectIdx === idx;
											const color = isCorrect
												? "text-green-400"
												: isSelected
													? "text-red-400"
													: "text-slate-400";
											const accent = isCorrect
												? "accent-green-500"
												: isSelected
													? "accent-red-500"
													: "accent-slate-500";
											return (
												<div
													key={`${task.id}-opt-${idx}`}
													className="flex items-center space-x-2 opacity-90"
												>
													<label className={`flex items-center gap-2 ${color}`}>
														<input
															type="radio"
															disabled
															checked={isSelected}
															className={accent}
														/>
														<span>{label}</span>
													</label>
												</div>
											);
										},
									)}
								</div>
							);
						})()}
					{cfgName === "short_text" &&
						(() => {
							const val =
								typeof (ans as { answer?: unknown })?.answer === "string"
									? ((ans as { answer?: unknown })?.answer as string)
									: "";
							const tone =
								verdict === "full_score"
									? "green"
									: verdict === "incorrect"
										? "red"
										: verdict === "on_review"
											? "amber"
											: "slate";
							const border =
								tone === "green"
									? "border-green-600"
									: tone === "red"
										? "border-red-600"
										: tone === "amber"
											? "border-amber-600"
											: "border-slate-700";
							const text =
								tone === "green"
									? "text-green-300"
									: tone === "red"
										? "text-red-300"
										: tone === "amber"
											? "text-amber-300"
											: "text-white";
							return (
								<input
									type="text"
									className={`w-full rounded-lg border bg-slate-800 p-3 ${border} ${text}`}
									value={val}
									readOnly
									disabled
								/>
							);
						})()}

					{cfgName === "long_text" &&
						(() => {
							const val =
								typeof (ans as { answer?: unknown })?.answer === "string"
									? ((ans as { answer?: unknown })?.answer as string)
									: "";
							const tone =
								verdict === "full_score"
									? "green"
									: verdict === "incorrect"
										? "red"
										: verdict === "on_review"
											? "amber"
											: "slate";
							const border =
								tone === "green"
									? "border-green-600"
									: tone === "red"
										? "border-red-600"
										: tone === "amber"
											? "border-amber-600"
											: "border-slate-700";
							const text =
								tone === "green"
									? "text-green-300"
									: tone === "red"
										? "text-red-300"
										: tone === "amber"
											? "text-amber-300"
											: "text-white";
							return (
								<textarea
									className={`w-full rounded-lg border bg-slate-800 p-3 ${border} ${text}`}
									rows={5}
									value={val}
									readOnly
									disabled
								/>
							);
						})()}

					{cfgName === "multiple_choice" &&
						Array.isArray((cfg as TaskConfig)?.options) &&
						(() => {
							const raw = (ans as { answers?: unknown[] })?.answers;
							const selectedIdxs: number[] = [];
							if (Array.isArray(raw)) {
								for (const v of raw as unknown[]) {
									if (typeof v === "number" && Number.isFinite(v)) {
										selectedIdxs.push(v);
									} else if (typeof v === "string") {
										const maybeNum = Number(v);
										if (
											Number.isFinite(maybeNum) &&
											Array.isArray((cfg as TaskConfig).options) &&
											(cfg as TaskConfig).options?.[maybeNum] !== undefined
										) {
											selectedIdxs.push(maybeNum);
										} else {
											const i = (
												(cfg as TaskConfig).options as string[]
											).indexOf(v);
											if (i >= 0) selectedIdxs.push(i);
										}
									}
								}
							}
							return (
								<div className="space-y-2">
									{((cfg as TaskConfig).options as string[]).map(
										(label, idx) => {
											const isSelected = selectedIdxs.includes(idx);
											const tone =
												verdict === "full_score"
													? "green"
													: verdict === "incorrect"
														? "red"
														: verdict === "on_review" ||
																verdict === "partial_score"
															? "amber"
															: "slate";
											const color = isSelected
												? tone === "green"
													? "text-green-400"
													: tone === "red"
														? "text-red-400"
														: tone === "amber"
															? "text-amber-400"
															: "text-slate-400"
												: "text-slate-400";
											const accent = isSelected
												? tone === "green"
													? "accent-green-500"
													: tone === "red"
														? "accent-red-500"
														: tone === "amber"
															? "accent-amber-500"
															: "accent-slate-500"
												: "accent-slate-500";
											return (
												<div
													key={`${task.id}-mc-${idx}`}
													className="flex items-center space-x-2 opacity-90"
												>
													<label className={`flex items-center gap-2 ${color}`}>
														<input
															type="checkbox"
															disabled
															checked={isSelected}
															className={accent}
														/>
														<span>{label}</span>
													</label>
												</div>
											);
										},
									)}
								</div>
							);
						})()}
					{cfgName === "ordering" &&
						Array.isArray((cfg as TaskConfig)?.items) && (
							<div className="space-y-2">
								{Array.isArray((ans as { answer?: unknown })?.answer) &&
									((ans as { answer?: unknown })?.answer as string[]).map(
										(idxStr: string, pos: number) => {
											const tone =
												verdict === "full_score"
													? "green"
													: verdict === "incorrect"
														? "red"
														: verdict === "on_review" ||
																verdict === "partial_score"
															? "amber"
															: "slate";
											const border =
												tone === "green"
													? "border-green-600"
													: tone === "red"
														? "border-red-600"
														: tone === "amber"
															? "border-amber-600"
															: "border-slate-700";
											const textColor =
												tone === "green"
													? "text-green-300"
													: tone === "red"
														? "text-red-300"
														: tone === "amber"
															? "text-amber-300"
															: "text-slate-300";
											const items = Array.isArray((cfg as TaskConfig).items)
												? ((cfg as TaskConfig).items as string[])
												: [];
											const maybeNum = Number(idxStr);
											let label: string;
											if (
												Number.isFinite(maybeNum) &&
												items[maybeNum] !== undefined
											) {
												label = items[maybeNum] as string;
											} else if (
												typeof idxStr === "string" &&
												idxStr.length > 0 &&
												items.includes(idxStr)
											) {
												label = idxStr;
											} else {
												label = String(idxStr);
											}
											return (
												<div
													key={`${pos}-${String(idxStr)}`}
													className={`rounded-lg border bg-slate-800 p-3 ${border} ${textColor}`}
												>
													{label}
												</div>
											);
										},
									)}
							</div>
						)}
					{cfgName === "file_upload" && (
						<div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-300">
							{t("file_upload") ?? "File upload"}:{" "}
							{typeof (ans as { file_id?: unknown })?.file_id === "string"
								? ((ans as { file_id?: unknown })?.file_id as string)
								: (t("no_results") ?? "No results")}
						</div>
					)}
				</CardContent>
			</Card>
		);
	}

	function renderInteractiveTask(task: PublicTaskDTO) {
		const onProgress = (_questionId: number, _hasAnswer: boolean) => {
			if (!attempt || !attempt.active) return;
		};
		const onAnswer = (payload: UiAnswerPayload) => {
			if (!attempt || !attempt.active) return;
			try {
				const dto = buildTaskAnswer(task, payload);
				latestAnswersRef.current[task.id] = dto;
			} catch {}
		};

		let initial: unknown = undefined;
		try {
			const cfg = (task as { configuration?: TaskConfig }).configuration ?? {};
			const cfgName: string | undefined =
				typeof (cfg as TaskConfig).name === "string"
					? (cfg as TaskConfig).name
					: undefined;
			const src = answersByTaskId[task.id] as
				| { answer?: unknown; answers?: unknown }
				| undefined;
			if (cfgName === "single_choice") {
				const v = src?.answer;
				if (typeof v === "number") {
					initial = v;
				} else if (typeof v === "string") {
					const maybeNum = Number(v);
					const opts = (cfg as TaskConfig).options;
					if (
						Number.isFinite(maybeNum) &&
						Array.isArray(opts) &&
						opts[maybeNum] !== undefined
					) {
						initial = maybeNum;
					} else {
						initial = v;
					}
				}
			} else if (cfgName === "multiple_choice") {
				const raw = Array.isArray(src?.answers)
					? (src?.answers as unknown[])
					: [];
				const opts = (cfg as TaskConfig).options;
				const numIndices: number[] = [];
				const strLabels: string[] = [];
				for (const x of raw) {
					if (typeof x === "number" && Number.isFinite(x)) {
						numIndices.push(x);
					} else if (typeof x === "string") {
						const maybeNum = Number(x);
						if (
							Number.isFinite(maybeNum) &&
							Array.isArray(opts) &&
							opts[maybeNum] !== undefined
						) {
							numIndices.push(maybeNum);
						} else if (
							typeof x === "string" &&
							x.length > 0 &&
							Array.isArray(opts) &&
							opts.includes(x)
						) {
							strLabels.push(x);
						}
					}
				}

				if (strLabels.length > 0) initial = strLabels;
				else if (numIndices.length > 0) initial = numIndices;
			} else if (cfgName === "short_text" || cfgName === "long_text") {
				const v = src?.answer;
				if (typeof v === "string") initial = v;
			}
		} catch {
			// ignore
		}
		const isLastTask =
			tasks.length > 0 &&
			taskIndex === tasks.length - 1 &&
			tasks[taskIndex]?.id === task.id;
		return (
			<TaskPlayer
				task={task}
				previewMode={isPreview}
				disabled={false}
				isLast={isLastTask}
				initial={initial as never}
				ctfdAlreadySynced={(() => {
					try {
						const ans = answersByTaskId[task.id];
						if (
							ans &&
							typeof ans === "object" &&
							(ans as { name?: string }).name === "ctfd"
						) {
							return true;
						}
					} catch {}
					return false;
				})()}
				onComplete={() => {
					submitBufferedForTask(task.id);
				}}
				onNext={() => {
					submitBufferedForTask(task.id);
					setTaskIndex(Math.min(tasks.length - 1, taskIndex + 1));
				}}
				onProgress={onProgress}
				onAnswer={onAnswer}
				onCtfdSync={async (taskId: number) => {
					if (!selectedExam) return;
					const body = {
						task_id: taskId,
						answer: { name: "ctfd" as const },
					};
					await patchAttempt(String(selectedExam.id), body);
					toast({
						description: t("synced_success") || "Solution synchronized",
					});
					// refresh attempt and tasks to reflect updated data
					refresh();
				}}
			/>
		);
	}

	useEffect(() => {
		if ((pendingExam?.id ?? null) === (selectedExam?.id ?? null)) return;
		const t = window.setTimeout(() => {
			setSelectedExam(pendingExam ?? null);
		}, 200);
		return () => window.clearTimeout(t);
	}, [pendingExam, selectedExam?.id]);

	/* biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally reset review state whenever the pending exam changes */
	useEffect(() => {
		setReviewMode(false);
		setSelectedReviewAttemptId(null);
		latestAnswersRef.current = {};
	}, [pendingExam?.id]);

	// Shared sidebar content (header + topics/exams list)
	function renderSidebarContent() {
		return (
			<>
				<div className="flex items-center justify-between border-slate-800 border-b p-4">
					<h2 className="font-semibold text-white">{t("course_structure")}</h2>
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
					{topicsQuery.isLoading ? (
						<div className="text-slate-400 text-sm">{t("loading")}</div>
					) : null}
					{/* Button to show course info in main content */}
					<button
						type="button"
						onClick={() => {
							setPendingExam(null);
							if (typeof window !== "undefined" && window.innerWidth < 640) {
								setSidebarOpen(false);
							}
						}}
						className={`flex w-full items-center rounded-lg p-2 text-left transition-colors ${
							!(pendingExam ?? selectedExam)
								? "bg-red-600 text-white"
								: "text-slate-300 hover:bg-slate-700"
						}`}
					>
						<div className="flex flex-1 items-center">
							<Info className="mr-2 h-4 w-4 flex-shrink-0 text-sky-400" />
							<span className="truncate text-sm">
								{t("course_info") ?? "Course info"}
							</span>
						</div>
					</button>
					{(topicsQuery.data ?? []).map((topic) => (
						<Collapsible key={topic.id} defaultOpen>
							<CollapsibleTrigger className="group flex w-full items-center justify-between overflow-hidden rounded-lg bg-slate-800 p-3 transition-colors hover:bg-slate-700">
								<div className="flex min-w-0 items-center">
									<BookOpen className="mr-2 h-4 w-4 text-slate-400" />
									<span className="truncate font-medium text-sm text-white">
										{topic.title}
									</span>
								</div>
								<ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-2 w-full space-y-1 overflow-x-hidden">
								{(examsByTopicQuery.data?.[topic.id] ?? []).map((exam) => (
									<button
										type="button"
										key={exam.id}
										onClick={() => {
											// Reset review state immediately to avoid flashing review UI
											setReviewMode(false);
											setSelectedReviewAttemptId(null);
											latestAnswersRef.current = {};
											setPendingExam(exam);
											if (
												typeof window !== "undefined" &&
												window.innerWidth < 640
											)
												setSidebarOpen(false);
										}}
										className={`flex w-full items-center overflow-hidden rounded-lg p-2 text-left transition-colors hover:overflow-hidden ${
											(pendingExam ?? selectedExam)?.id === exam.id
												? "bg-red-600 text-white"
												: "text-slate-300 hover:bg-slate-700"
										}`}
									>
										<div className="flex flex-1 items-center">
											<HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 self-center text-orange-400" />
											<div className="min-w-0 overflow-hidden">
												<div className="w-full truncate text-ellipsis whitespace-nowrap font-medium text-sm hover:truncate">
													{exam.name}
												</div>
												<div className="w-full truncate text-ellipsis whitespace-nowrap text-xs opacity-80 hover:truncate">
													{t("exam") ?? "Exam"}
												</div>
											</div>
										</div>
									</button>
								))}
							</CollapsibleContent>
						</Collapsible>
					))}
				</div>
			</>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<div className="flex">
				{/* Backdrop for mobile */}
				{sidebarOpen && (
					<div
						className="fixed inset-0 z-50 bg-black/50 sm:hidden"
						onClick={() => setSidebarOpen(false)}
						role="button"
						tabIndex={0}
						aria-label="Close sidebar overlay"
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSidebarOpen(false);
							}
						}}
					/>
				)}

				{/* Mobile Sidebar (drawer) */}
				<div
					className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[80vw] transform border-slate-800 border-r bg-slate-900 transition-transform duration-300 sm:hidden ${
						sidebarOpen ? "translate-x-0" : "-translate-x-full"
					}`}
				>
					{renderSidebarContent()}
				</div>

				{/* Desktop Sidebar (collapsible rail) */}
				<div
					className={`hidden sm:flex ${sidebarOpen ? "w-80" : "w-0"} shrink-0 overflow-hidden border-slate-800 border-r bg-slate-900 transition-[width] duration-300`}
				>
					<div className="w-80">{renderSidebarContent()}</div>
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
							<Link href={`/course/${courseId}`}>
								<Button
									variant="ghost"
									size="sm"
									className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
								>
									<ArrowLeft className="h-4 w-4" />
								</Button>
							</Link>
							<h1 className="truncate font-semibold text-sm text-white lg:text-base">
								{selectedExam
									? selectedExam.name || t("exam")
									: (courseQuery.data?.name ?? t("course_structure"))}
							</h1>
						</div>

						{selectedExam && (isPreview || attempt?.active) && !reviewMode ? (
							<div className="flex flex-shrink-0 items-center space-x-1 lg:space-x-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setTaskIndex(Math.max(0, taskIndex - 1))}
									disabled={!canPrev}
									className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
								>
									<ChevronLeft className="h-3 w-3 lg:mr-1 lg:h-4 lg:w-4" />
									<span className="hidden sm:inline">{t("previous")}</span>
								</Button>

								<Button
									variant="outline"
									size="sm"
									disabled={!canNext}
									onClick={() => {
										const cur = tasks[taskIndex];
										if (cur) submitBufferedForTask(cur.id);
										setTaskIndex(Math.min(tasks.length - 1, taskIndex + 1));
									}}
									className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
								>
									<span className="hidden sm:inline">{t("next")}</span>
									<ChevronRight className="h-3 w-3 lg:ml-1 lg:h-4 lg:w-4" />
								</Button>

								{attempt ? (
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												disabled={stopping || !attempt.active}
												className="text-red-400 hover:text-red-300"
												title={
													attempt.active
														? (t("finish") ?? "Finish")
														: (t("finished") ?? "Finished")
												}
											>
												{attempt.active
													? (t("finish") ?? "Finish")
													: (t("finished") ?? "Finished")}
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													{t("confirm_finish_title") || "Finish attempt?"}
												</AlertDialogTitle>
												<AlertDialogDescription>
													{t("confirm_finish_desc") ||
														"Are you sure you want to end this attempt? You won't be able to change your answers afterwards."}
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>
													{t("cancel") || "Cancel"}
												</AlertDialogCancel>
												<AlertDialogAction
													onClick={async () => {
														submitAllBuffered();
														await flushNow();
														stop();
														setTimeout(() => {
															refresh();
														}, 300);
													}}
													className="bg-red-600 text-white hover:bg-red-700"
												>
													{t("finish") || "Finish"}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								) : null}
							</div>
						) : null}
					</div>

					{/* Content */}
					<div
						className={`max-w-full flex-1 overflow-x-hidden p-3 lg:p-6 ${attempt?.active && tasks.length > 0 && !reviewMode ? "pb-24" : ""}`}
					>
						{!selectedExam ? (
							<div className="space-y-4">
								<Card className="mx-auto w-full max-w-[680px] border-slate-800 bg-slate-900">
									<CardHeader className="p-4 sm:p-6">
										<CardTitle className="text-2xl text-white">
											{courseQuery.data?.name ?? t("course_structure")}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
										{courseQuery.data?.description ? (
											<Markdown
												content={courseQuery.data.description}
												className="markdown-body max-w-none text-slate-300 text-sm sm:text-base"
											/>
										) : null}
										<div className="grid grid-cols-1 gap-2 text-slate-300 sm:grid-cols-2">
											<div className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
												<strong className="mr-2 text-white">
													{t("topics") ?? "Topics"}:
												</strong>
												<span>{topicsCount}</span>
											</div>
											<div className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
												<strong className="mr-2 text-white">
													{t("exams") ?? "Exams"}:
												</strong>
												<span>{examsCount}</span>
											</div>
										</div>
									</CardContent>
								</Card>
								<Card className="mx-auto w-full max-w-[680px] border-slate-800 bg-slate-900">
									<CardHeader>
										<CardTitle className="text-white">
											{t("course_structure")}
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										{(topicsQuery.data ?? []).map((topic) => (
											<Collapsible key={topic.id} defaultOpen>
												<CollapsibleTrigger className="group flex w-full items-center justify-between overflow-hidden rounded-lg bg-slate-800 p-3 transition-colors hover:bg-slate-700">
													<div className="flex min-w-0 items-center">
														<BookOpen className="mr-2 h-4 w-4 text-slate-400" />
														<span className="truncate font-medium text-sm text-white">
															{topic.title}
														</span>
													</div>
													<ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
												</CollapsibleTrigger>
												<CollapsibleContent className="mt-2 w-full space-y-1 overflow-x-hidden">
													{(examsByTopicQuery.data?.[topic.id] ?? []).map(
														(exam) => (
															<button
																type="button"
																key={exam.id}
																onClick={() => {
																	setReviewMode(false);
																	setSelectedReviewAttemptId(null);
																	latestAnswersRef.current = {};
																	setPendingExam(exam);
																}}
																className={`flex w-full items-center overflow-hidden rounded-lg p-2 text-left transition-colors hover:overflow-hidden ${
																	(pendingExam ?? selectedExam)?.id === exam.id
																		? "bg-slate-700 text-white"
																		: "text-slate-300 hover:bg-slate-700"
																}`}
															>
																<div className="flex flex-1 items-center">
																	<HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 self-center text-orange-400" />
																	<div className="min-w-0 overflow-hidden">
																		<div className="w-full truncate text-ellipsis whitespace-nowrap font-medium text-sm hover:truncate">
																			{exam.name}
																		</div>
																		<div className="w-full truncate text-ellipsis whitespace-nowrap text-xs opacity-80 hover:truncate">
																			{t("exam") ?? "Exam"}
																		</div>
																		<div className="w-full truncate text-ellipsis whitespace-nowrap text-[11px] text-slate-400">
																			{[
																				t(
																					exam.type === "Instant"
																						? "exam_type_instant"
																						: "exam_type_delayed",
																				),
																				(exam.duration ?? 0) === 0
																					? t("no_timer") || "No timer"
																					: `${Math.ceil((exam.duration ?? 0) / 60)} ${t("minutes_short") || "min"}`,
																				(exam.tries_count ?? 0) === 0
																					? t("attempts_up_to_infty") ||
																						`up to ${t("infty_attempts")}`
																					: t("attempts_up_to", {
																							count: exam.tries_count,
																						}) ||
																						`up to ${exam.tries_count} attempts`,
																			].join(" · ")}
																		</div>
																	</div>
																</div>
															</button>
														),
													)}
												</CollapsibleContent>
											</Collapsible>
										))}
									</CardContent>
								</Card>
							</div>
						) : switching ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="space-y-3 p-6">
									<div className="h-5 w-40 animate-pulse rounded bg-slate-800" />
									<div className="h-4 w-72 animate-pulse rounded bg-slate-800" />
								</CardContent>
							</Card>
						) : !isStaff && !reviewMode && loading ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="space-y-3 p-6">
									<div className="h-5 w-40 animate-pulse rounded bg-slate-800" />
									<div className="h-4 w-72 animate-pulse rounded bg-slate-800" />
								</CardContent>
							</Card>
						) : !isStaff &&
							ranOutEffective &&
							!reviewMode &&
							!attempt?.active &&
							!starting &&
							!loading ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="space-y-3 p-6">
									<div className="text-slate-300">
										{t("exam_card", {
											type: t(
												selectedExam.type === "Instant"
													? "exam_type_instant"
													: "exam_type_delayed",
											),
											duration:
												(selectedExam.duration ?? 0) === 0
													? t("no_timer") || "No timer"
													: `${Math.ceil((selectedExam.duration ?? 0) / 60)} ${t("minutes_short") || "min"}`,
											tries:
												(selectedExam.tries_count ?? 0) === 0
													? t("infty_attempts") || "Infinite attempts"
													: `${selectedExam.tries_count}`,
										})}
									</div>
									<div className="mb-2">
										<h2 className="font-semibold text-2xl text-white">
											{selectedExam.name}
										</h2>
										{selectedExam.description ? (
											<div className="mt-1">
												<Markdown content={selectedExam.description} />
											</div>
										) : null}
									</div>
									<div className="my-3 h-px bg-slate-800" />
									<div className="text-slate-400 text-sm">
										{t("no_attempts_left") ||
											"You have no attempts left for this exam."}
									</div>
									{hasViewableAttempts ? (
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												onClick={() => setReviewMode(true)}
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
											>
												{t("watch_attempts") ?? "Watch attempts"}
											</Button>
										</div>
									) : null}
								</CardContent>
							</Card>
						) : !isStaff &&
							(!attempt || !attempt.active) &&
							!ranOutEffective &&
							!reviewMode &&
							!loading ? (
							<Card className="border-slate-800 bg-slate-900">
								<CardContent className="p-6">
									<div className="mb-3 text-slate-300">
										{t("exam_card", {
											type: t(
												selectedExam.type === "Instant"
													? "exam_type_instant"
													: "exam_type_delayed",
											),
											duration:
												(selectedExam.duration ?? 0) === 0
													? t("no_timer") || "No timer"
													: `${selectedExam.duration}s`,
											tries:
												(selectedExam.tries_count ?? 0) === 0
													? t("infty_attempts") || "Infinite attempts"
													: `${selectedExam.tries_count}`,
										})}
									</div>
									<div className="mb-3">
										<h2 className="font-semibold text-lg text-white">
											{selectedExam.name}
										</h2>
										{selectedExam.description ? (
											<p className="mt-1 whitespace-pre-wrap text-slate-300 text-sm">
												{selectedExam.description}
											</p>
										) : null}
										<div className="my-3 h-px bg-slate-800" />
									</div>
									<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
										{ranOutEffective ? (
											<div className="text-slate-400 text-sm">
												{t("no_attempts_left") ||
													"You have no attempts left for this exam."}
											</div>
										) : (
											<Button
												onClick={handleStart}
												disabled={starting || loading}
												size="sm"
												className="!transition-none !duration-0 w-full bg-red-600 px-2 text-white hover:bg-red-700 sm:w-auto sm:px-3"
												title={
													tasks.length === 0
														? (t("no_tasks_attached") ?? "No tasks attached")
														: undefined
												}
											>
												<Play className="h-4 w-4 sm:mr-2" />
												{t("start_exam") ?? "Start attempt"}
											</Button>
										)}
										{!isStaff &&
										attempt &&
										!attempt.active &&
										attempt.scoring_data?.show_results ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setReviewMode(true)}
												className="w-full border-slate-700 bg-transparent px-2 text-slate-300 hover:bg-slate-800 sm:w-auto sm:px-3"
											>
												{t("watch_attempts") ?? "Watch attempts"}
											</Button>
										) : null}
									</div>
								</CardContent>
							</Card>
						) : (
							<div className="space-y-4">
								{attempt ? (
									<div className="text-slate-400 text-xs">
										{attempt.active
											? (t("attempt_active") ?? "Attempt active")
											: (t("attempt_finished") ?? "Attempt finished")}{" "}
										· {t("started_at") ?? "Started"}:{" "}
										{new Date(attempt.started_at).toLocaleString()}
									</div>
								) : isStaff ? (
									<div className="text-slate-400 text-xs">
										{t("preview_mode") ?? "Preview mode (no attempt)"}
									</div>
								) : null}

								{!attempt?.active && attempt?.scoring_data?.show_results ? (
									<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
										{!reviewMode ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => setReviewMode(true)}
												className="w-full border-slate-700 bg-transparent px-2 text-slate-300 hover:bg-slate-800 sm:w-auto sm:px-3"
											>
												{t("watch_attempts") ?? "Watch attempts"}
											</Button>
										) : null}
									</div>
								) : null}

								{reviewMode ? (
									<div className="space-y-4">
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												onClick={() => setReviewMode(false)}
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
											>
												{t("back") ?? "Back"}
											</Button>
										</div>
										{/* Attempt selector for review mode */}
										{sortedAttempts.length > 0 ? (
											<div className="flex flex-wrap items-center gap-2 text-sm">
												<label
													className="text-slate-300"
													htmlFor="reviewAttemptSelect"
												>
													{t("select_attempt") ?? "Select attempt"}:
												</label>
												<select
													id="reviewAttemptSelect"
													className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
													value={
														selectedReviewAttemptId ??
														(sortedAttempts[0]
															? String(sortedAttempts[0].id)
															: "")
													}
													onChange={(e) =>
														setSelectedReviewAttemptId(e.target.value)
													}
												>
													{sortedAttempts.map((a) => (
														<option key={a.id} value={String(a.id)}>
															{new Date(a.started_at).toLocaleString()}
														</option>
													))}
												</select>
											</div>
										) : null}
										{tasks.length === 0 ? (
											<div className="text-slate-400 text-sm">
												{t("no_tasks_attached") ?? "No tasks attached yet."}
											</div>
										) : (
											tasks.map((tTask) => renderReadOnlyTask(tTask))
										)}
									</div>
								) : tasks.length === 0 ? (
									<div className="text-slate-400 text-sm">
										{t("no_tasks_attached") ?? "No tasks attached yet."}
									</div>
								) : (
									<>
										{tasks[taskIndex]
											? renderInteractiveTask(tasks[taskIndex] as PublicTaskDTO)
											: null}
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Right Sidebar: timer + progress (active attempt or preview) */}
				{(attempt?.active || isPreview) && tasks.length > 0 && !reviewMode ? (
					<div className="hidden w-60 shrink-0 border-slate-800 border-l bg-slate-900 p-3 lg:block">
						{attempt?.active ? (
							(selectedExam?.duration ?? 0) > 0 && remainingSec !== null ? (
								<div
									className={`mb-3 flex items-center justify-center rounded-md border px-2 py-2 text-sm ${
										remainingSec <= 30
											? "border-red-600 text-red-400"
											: remainingSec <= 120
												? "border-amber-600 text-amber-400"
												: "border-slate-700 text-slate-300"
									}`}
									title={t("time_left") || "Time left"}
								>
									<span className="mr-2 opacity-80">
										{t("time_left") || "Time left"}:
									</span>
									<span className="font-mono text-base">
										{formatTime(remainingSec)}
									</span>
								</div>
							) : (
								(selectedExam?.duration ?? 0) === 0 && (
									<div
										className="mb-3 flex items-center justify-center rounded-md border border-slate-700 px-2 py-2 text-slate-300 text-sm"
										title={t("no_timer") || "No timer"}
									>
										<span className="font-mono">
											{t("no_timer") || "No timer"}
										</span>
									</div>
								)
							)
						) : null}

						<div className="mb-2 text-center font-medium text-slate-300 text-xs">
							{t("progress") || "Progress"}
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{tasks.map((tTask, idx) => {
								const id = tTask.id;
								const isSubmitted = submittedIds.has(id);
								return (
									<button
										key={id}
										type="button"
										onClick={() => setTaskIndex(idx)}
										className={`flex h-8 w-8 items-center justify-center rounded ${
											isSubmitted
												? "bg-red-600 text-white"
												: "bg-slate-700 text-slate-300"
										} ${idx === taskIndex ? "ring-2 ring-red-400" : ""}`}
										title={`${t("task") || "Task"} #${idx + 1}`}
									>
										<span className="font-semibold text-[11px]">{idx + 1}</span>
									</button>
								);
							})}
						</div>
					</div>
				) : null}
			</div>

			{/* Mobile Footer: timer + progress (active attempt or preview) */}
			{(attempt?.active || isPreview) && tasks.length > 0 && !reviewMode ? (
				<div className="fixed inset-x-0 bottom-0 z-20 border-slate-800 border-t bg-slate-900 p-3 lg:hidden">
					{/* Timer visible only during active attempt */}
					{attempt?.active ? (
						(selectedExam?.duration ?? 0) > 0 && remainingSec !== null ? (
							<div
								className={`mb-3 flex items-center justify-center rounded-md border px-2 py-2 text-sm ${
									remainingSec <= 30
										? "border-red-600 text-red-400"
										: remainingSec <= 120
											? "border-amber-600 text-amber-400"
											: "border-slate-700 text-slate-300"
								}`}
								title={t("time_left") || "Time left"}
							>
								<span className="mr-2 opacity-80">
									{t("time_left") || "Time left"}:
								</span>
								<span className="font-mono text-base">
									{formatTime(remainingSec)}
								</span>
							</div>
						) : (
							(selectedExam?.duration ?? 0) === 0 && (
								<div
									className="mb-3 flex items-center justify-center rounded-md border border-slate-700 px-2 py-2 text-slate-300 text-sm"
									title={t("no_timer") || "No timer"}
								>
									<span className="font-mono">
										{t("no_timer") || "No timer"}
									</span>
								</div>
							)
						)
					) : null}

					<div className="mb-2 text-center font-medium text-slate-300 text-xs">
						{t("progress") || "Progress"}
					</div>
					<div className="flex items-center justify-center">
						<div className="max-w-full overflow-x-auto">
							<div className="flex items-center gap-2">
								{tasks.map((tTask, idx) => {
									const id = tTask.id;
									const isSubmitted = submittedIds.has(id);
									return (
										<button
											key={id}
											type="button"
											onClick={() => setTaskIndex(idx)}
											className={`flex h-8 w-8 items-center justify-center rounded ${
												isSubmitted
													? "bg-red-600 text-white"
													: "bg-slate-700 text-slate-300"
											} ${idx === taskIndex ? "ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900" : ""}`}
											title={`${t("task") || "Task"} #${idx + 1}`}
										>
											<span className="font-semibold text-[11px]">
												{idx + 1}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			) : null}
			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
		</div>
	);
}
