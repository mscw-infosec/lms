"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
	type ExamAttemptAdmin,
	type PubExamExtendedEntity,
	type TaskVerdict,
	getExamEntities,
	listExamAttemptsAdmin,
	patchAttemptTaskVerdict,
	setAttemptVisibility,
	setExamAttemptsVisibility,
} from "@/api/exam";
import type { components } from "@/api/schema/schema";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import Markdown from "@/components/markdown";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getPointsPlural } from "@/lib/utils";
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react";
import { useTranslation } from "react-i18next";

// Helper types

type TaskMeta = {
	id: number;
	title: string;
	points: number;
};

type VerdictEdit = TaskVerdict;

export default function AttemptsAdminPage() {
	const params = useParams<{ examId: string }>();
	const examId = String(params.examId);
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation("common");

	const [page, setPage] = useState(0);
	const [ungradedFirst, setUngradedFirst] = useState(true);
	const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
		null,
	);
	const [saving, setSaving] = useState(false);

	// Auth modal state for Header actions
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	// Track baseline (original) edits to detect unsaved changes
	const [baselineEdits, setBaselineEdits] = useState<
		Record<number, VerdictEdit>
	>({});

	// Confirm modal for toggling visibility for all attempts
	const [confirmAllOpen, setConfirmAllOpen] = useState(false);
	const [confirmAllMakeVisible, setConfirmAllMakeVisible] =
		useState<boolean>(true);
	const [processingAll, setProcessingAll] = useState(false);

	// Unsaved changes warning when switching attempts
	const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
	const [pendingSelectAttemptId, setPendingSelectAttemptId] = useState<
		string | null
	>(null);

	// Fetch exam entities (to get tasks meta)
	const entitiesQuery = useQuery<PubExamExtendedEntity[]>({
		queryKey: ["exam-entities", examId],
		queryFn: () => getExamEntities(examId),
		staleTime: 30_000,
	});

	const tasksMeta = useMemo(() => {
		const res: Record<number, TaskMeta> = {};
		const list = entitiesQuery.data ?? [];
		for (const ent of list) {
			if (ent.type === "task") {
				const task = ent.task;
				res[task.id] = {
					id: task.id,
					title: task.title,
					points: Number(task.points ?? 0),
				};
			}
		}
		return res;
	}, [entitiesQuery.data]);

	// Map of full task DTOs for answer rendering
	const tasksById = useMemo(() => {
		const res: Record<number, components["schemas"]["PublicTaskDTO"]> = {};
		for (const ent of entitiesQuery.data ?? []) {
			if (ent.type === "task") {
				res[ent.task.id] = ent.task;
			}
		}
		return res;
	}, [entitiesQuery.data]);

	type TaskAnswer = components["schemas"]["TaskAnswer"];

	// Fetch attempts list
	const attemptsQuery = useQuery<ExamAttemptAdmin[]>({
		queryKey: ["exam-attempts-admin", examId, page, ungradedFirst],
		queryFn: () =>
			listExamAttemptsAdmin(examId, {
				limit: 20,
				offset: page * 20,
				ungraded_first: ungradedFirst,
			}),
		placeholderData: keepPreviousData,
	});

	const selectedAttempt: ExamAttemptAdmin | undefined = useMemo(() => {
		const atts = attemptsQuery.data || [];
		return atts.find((a) => a.id === selectedAttemptId) || atts[0];
	}, [attemptsQuery.data, selectedAttemptId]);

	const answersMap = useMemo(() => {
		return (selectedAttempt?.answer_data?.answers ?? {}) as Record<
			string,
			TaskAnswer
		>;
	}, [selectedAttempt]);

	// Local editable state for verdicts per task
	const [edits, setEdits] = useState<Record<number, VerdictEdit>>({});

	const onChangeVerdict = (
		taskId: number,
		verdictName: "on_review" | "incorrect" | "partial_score" | "full_score",
	) => {
		const meta = tasksMeta[taskId];
		if (!meta) return;
		setEdits((prev) => {
			const previous = prev[taskId];
			const previousComment =
				previous && previous.verdict !== "on_review"
					? (previous.comment ?? null)
					: null;
			if (verdictName === "on_review") {
				return { ...prev, [taskId]: { verdict: "on_review" } };
			}
			if (verdictName === "incorrect") {
				return {
					...prev,
					[taskId]: {
						verdict: "incorrect",
						max_score: meta.points,
						score: 0,
						comment: previousComment,
					},
				};
			}
			if (verdictName === "full_score") {
				return {
					...prev,
					[taskId]: {
						verdict: "full_score",
						max_score: meta.points,
						score: meta.points,
						comment: previousComment,
					},
				};
			}
			const prevScore =
				previous && previous.verdict !== "on_review" ? previous.score : 0;
			const score = Math.min(
				meta.points,
				Math.max(0, Number.isFinite(prevScore) ? prevScore : 0),
			);
			return {
				...prev,
				[taskId]: {
					verdict: "partial_score",
					max_score: meta.points,
					score,
					comment: previousComment,
				},
			};
		});
	};

	const onChangeScore = (taskId: number, score: number) => {
		const meta = tasksMeta[taskId];
		if (!meta) return;
		setEdits((prev) => {
			const v = prev[taskId];
			if (!v || v.verdict === "on_review") return prev;
			// For incorrect and full_score verdicts, score is fixed and must not change
			if (v.verdict === "incorrect" || v.verdict === "full_score") {
				return prev;
			}
			// Only partial_score allows manual editing within [0, max]
			const clamped = Math.max(
				0,
				Math.min(meta.points, Number.isFinite(score) ? score : 0),
			);
			if (v.verdict === "partial_score") {
				return {
					...prev,
					[taskId]: { ...v, score: clamped, max_score: meta.points },
				};
			}
			return prev;
		});
	};

	const onChangeComment = (taskId: number, comment: string) => {
		setEdits((prev) => {
			const v = prev[taskId];
			if (!v || v.verdict === "on_review") return prev;
			if (
				v.verdict === "incorrect" ||
				v.verdict === "partial_score" ||
				v.verdict === "full_score"
			) {
				return { ...prev, [taskId]: { ...v, comment } };
			}
			return prev;
		});
	};

	const saveChanges = async () => {
		if (!selectedAttempt) return;
		try {
			setSaving(true);
			const original = (selectedAttempt.scoring_data?.results ?? {}) as Record<
				string,
				TaskVerdict
			>;
			for (const [taskIdStr, edited] of Object.entries(edits)) {
				const taskId = Number(taskIdStr);
				const orig = original[taskIdStr];
				// compare shallowly
				const different =
					!orig || JSON.stringify(edited) !== JSON.stringify(orig);
				if (!different) continue;
				await patchAttemptTaskVerdict(examId, selectedAttempt.id, {
					task_id: taskId,
					verdict: edited,
				});
			}
			await attemptsQuery.refetch();
			setBaselineEdits(edits);
			toast({
				title: t("saved_successfully"),
				description: t("attempt_verdicts_updated"),
			});
		} catch (e: unknown) {
			toast({
				title: t("error"),
				description: e instanceof Error ? e.message : t("failed_save_changes"),
				variant: "destructive",
			});
		} finally {
			setSaving(false);
		}
	};

	const attemptShowResults = !!selectedAttempt?.scoring_data?.show_results;

	// Ordered list of task entities (preserve original exam order)
	const taskEntities = useMemo(() => {
		const res: components["schemas"]["PublicTaskDTO"][] = [];
		for (const ent of entitiesQuery.data ?? []) {
			if ((ent as { type?: string }).type === "task")
				res.push(
					(ent as { task: components["schemas"]["PublicTaskDTO"] }).task,
				);
		}
		return res;
	}, [entitiesQuery.data]);

	// Initialize edits on attempt change
	useEffect(() => {
		if (!selectedAttempt) return;
		const initial: Record<number, VerdictEdit> = {};
		const results = (selectedAttempt.scoring_data?.results ?? {}) as Record<
			string,
			TaskVerdict
		>;
		for (const [taskIdStr, verdict] of Object.entries(results)) {
			const taskId = Number(taskIdStr);
			initial[taskId] = verdict;
		}
		// Prefill incorrect for tasks without answers and without existing verdict
		for (const t of taskEntities) {
			if (!t) continue;
			const id = t.id;
			if (initial[id]) continue;
			const hasAnswer = !!answersMap[String(id)];
			if (!hasAnswer) {
				const pts = tasksMeta[id]?.points ?? Number(tasksById[id]?.points ?? 0);
				initial[id] = { verdict: "incorrect", max_score: pts, score: 0 };
			}
		}
		setEdits(initial);
		setBaselineEdits(initial);
	}, [selectedAttempt, taskEntities, answersMap, tasksMeta, tasksById]);

	// Dirty state detection
	const isDirty = useMemo(() => {
		try {
			return JSON.stringify(edits) !== JSON.stringify(baselineEdits);
		} catch {
			return false;
		}
	}, [edits, baselineEdits]);

	const handleSelectAttempt = (id: string) => {
		if (selectedAttempt?.id === id) return;
		if (isDirty) {
			setPendingSelectAttemptId(id);
			setUnsavedModalOpen(true);
		} else {
			setSelectedAttemptId(id);
		}
	};

	// Current task index for task-player-like navigation
	const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset current task when selected attempt changes
	useEffect(() => {
		setCurrentTaskIdx(0);
	}, [selectedAttemptId]);

	// Verdicts by task id, prefer local edits over original results
	const verdictsByTaskId = useMemo(() => {
		const out: Record<number, TaskVerdict["verdict"] | undefined> = {};
		const original = (selectedAttempt?.scoring_data?.results ?? {}) as Record<
			string,
			TaskVerdict
		>;
		for (const t of taskEntities) {
			if (!t) continue;
			const ed = edits[t.id];
			if (ed) out[t.id] = ed.verdict;
			else {
				const orig = original[String(t.id)];
				if (orig) out[t.id] = orig.verdict;
				else if (!answersMap[String(t.id)]) out[t.id] = "incorrect";
				else out[t.id] = undefined;
			}
		}
		return out;
	}, [edits, selectedAttempt, taskEntities, answersMap]);

	return (
		<>
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<div className="min-h-screen space-y-4 bg-slate-950 p-4 text-white">
				{/* Global show/hide confirmation */}
				<AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{confirmAllMakeVisible
									? t("show_results_for_all_confirm_title")
									: t("hide_results_for_all_confirm_title")}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{confirmAllMakeVisible
									? t("show_results_for_all_confirm_desc")
									: t("hide_results_for_all_confirm_desc")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								disabled={processingAll}
								onClick={() => {
									setConfirmAllOpen(false);
								}}
							>
								{t("cancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								disabled={processingAll}
								onClick={async () => {
									try {
										setProcessingAll(true);
										await setExamAttemptsVisibility(
											examId,
											confirmAllMakeVisible,
										);
										await attemptsQuery.refetch();
										toast({
											title: t("updated"),
											description: confirmAllMakeVisible
												? t("results_visible_all")
												: t("results_hidden_all"),
										});
									} catch (e) {
										toast({
											title: t("error"),
											description: t("failed_update_visibility_all"),
											variant: "destructive",
										});
									} finally {
										setProcessingAll(false);
										setConfirmAllOpen(false);
									}
								}}
							>
								{confirmAllMakeVisible ? t("yes_show") : t("yes_hide")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				{/* Unsaved changes warning when switching attempts */}
				<AlertDialog open={unsavedModalOpen} onOpenChange={setUnsavedModalOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t("unsaved_changes_title")}</AlertDialogTitle>
							<AlertDialogDescription>
								{t("unsaved_changes_desc")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								onClick={() => {
									setUnsavedModalOpen(false);
									setPendingSelectAttemptId(null);
								}}
							>
								{t("stay")}
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									if (pendingSelectAttemptId) {
										setSelectedAttemptId(pendingSelectAttemptId);
									}
									setPendingSelectAttemptId(null);
									setUnsavedModalOpen(false);
								}}
							>
								{t("discard_changes")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						onClick={() => router.back()}
						className="text-white hover:bg-slate-800"
					>
						<ArrowLeft className="mr-1 h-4 w-4" /> {t("back")}
					</Button>
					<h1 className="font-semibold text-lg text-white">
						{t("attempts_admin")}
					</h1>
				</div>

				<Card className="border-slate-800 bg-slate-900">
					<CardHeader>
						<CardTitle className="flex items-center justify-between text-white">
							<span>{t("exam_attempts")}</span>
							<div className="flex items-center gap-2">
								<label
									htmlFor="ungraded-first"
									className="text-slate-200 text-sm"
								>
									{t("ungraded_first")}
								</label>
								<Switch
									id="ungraded-first"
									checked={ungradedFirst}
									onCheckedChange={(v) => setUngradedFirst(Boolean(v))}
								/>
								<Button
									size="sm"
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									onClick={() => {
										setConfirmAllMakeVisible(true);
										setConfirmAllOpen(true);
									}}
								>
									<Eye className="mr-1 h-4 w-4" /> {t("show_results_for_all")}
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									onClick={() => {
										setConfirmAllMakeVisible(false);
										setConfirmAllOpen(true);
									}}
								>
									<EyeOff className="mr-1 h-4 w-4" />{" "}
									{t("hide_results_for_all")}
								</Button>
							</div>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
							<div className="space-y-2">
								{(attemptsQuery.data || []).map((att) => (
									<button
										type="button"
										key={att.id}
										onClick={() => handleSelectAttempt(att.id)}
										className={`w-full rounded-md border p-2 text-left transition-colors ${selectedAttempt?.id === att.id ? "border-blue-500/70 bg-slate-800/60" : "border-slate-800 hover:bg-slate-800/40"}`}
									>
										<div className="flex items-center justify-between">
											<div>
												<div className="font-medium text-slate-400 text-sm">
													{att.id}
												</div>
												<div className="text-slate-300 text-xs">
													{t("started")}:{" "}
													{new Date(att.started_at).toLocaleString()} •{" "}
													{t("ends")}: {new Date(att.ends_at).toLocaleString()}
												</div>
											</div>
											<div className="text-slate-400 text-xs">
												{att.scoring_data?.show_results
													? t("visible")
													: t("hidden")}
											</div>
										</div>
									</button>
								))}

								<div className="flex items-center justify-between pt-2">
									<Button
										size="sm"
										variant="outline"
										className="border-slate-700 text-white hover:bg-slate-800"
										onClick={() => setPage((p) => Math.max(0, p - 1))}
										disabled={page === 0}
									>
										{t("previous")}
									</Button>
									<div className="text-sm">
										{t("page")} {page + 1}
									</div>
									<Button
										size="sm"
										variant="outline"
										className="border-slate-700 text-white hover:bg-slate-800"
										onClick={() => setPage((p) => p + 1)}
										disabled={(attemptsQuery.data || []).length < 20}
									>
										{t("next")}
									</Button>
								</div>
							</div>

							<div className="space-y-3 lg:col-span-2">
								{selectedAttempt ? (
									<>
										<div className="flex items-center justify-between">
											<div className="font-semibold text-white">
												{t("attempt_details")}
											</div>
											<div className="flex items-center gap-2">
												<label
													htmlFor="attempt-show-results"
													className="text-slate-200 text-sm"
												>
													{t("show_results_for_this_attempt")}
												</label>
												<Switch
													id="attempt-show-results"
													checked={attemptShowResults}
													onCheckedChange={async (v) => {
														try {
															await setAttemptVisibility(
																selectedAttempt.id,
																!!v,
															);
															await attemptsQuery.refetch();
														} catch (e: unknown) {
															toast({
																title: t("error"),
																description: t("failed_update_visibility"),
																variant: "destructive",
															});
														}
													}}
												/>
											</div>
										</div>

										<Card className="border-slate-800 bg-slate-900">
											<CardHeader>
												<CardTitle className="text-white">
													{t("review_and_grade")}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="flex gap-4">
													<div className="hidden w-60 shrink-0 border-slate-800 border-r bg-slate-900 p-3 lg:block">
														<div className="mb-2 text-center font-medium text-slate-300 text-xs">
															{t("progress")}
														</div>
														<div className="grid grid-cols-4 gap-2">
															{taskEntities.map((task, idx) => {
																const v = verdictsByTaskId[task.id];
																const bg =
																	v === "full_score"
																		? "bg-green-600 text-white"
																		: v === "incorrect"
																			? "bg-red-600 text-white"
																			: v === "partial_score"
																				? "bg-amber-600 text-white"
																				: "bg-slate-700 text-slate-300"; // on_review or undefined -> grey
																return (
																	<button
																		key={`rev-task-${task.id}`}
																		type="button"
																		onClick={() => setCurrentTaskIdx(idx)}
																		className={`flex h-8 w-8 items-center justify-center rounded ${bg} ${idx === currentTaskIdx ? "ring-2 ring-indigo-400" : ""}`}
																		title={`${t("task")} #${idx + 1}`}
																	>
																		<span className="font-semibold text-[11px]">
																			{idx + 1}
																		</span>
																	</button>
																);
															})}
														</div>
													</div>
													<div className="flex-1">
														{(() => {
															const task = taskEntities[currentTaskIdx];
															if (!task)
																return (
																	<div className="text-slate-300 text-sm">
																		(no task)
																	</div>
																);
															const meta = tasksMeta[task.id];
															const originalResults = (selectedAttempt
																?.scoring_data?.results ?? {}) as Record<
																string,
																TaskVerdict
															>;
															const v: TaskVerdict =
																edits[task.id] ??
																originalResults[String(task.id)] ??
																(!answersMap[String(task.id)]
																	? {
																			verdict: "incorrect",
																			max_score:
																				meta?.points ??
																				Number(tasksById[task.id]?.points ?? 0),
																			score: 0,
																		}
																	: { verdict: "on_review" });
															const name = v.verdict;
															const dto = tasksById[task.id];
															const cfg = dto?.configuration as
																| components["schemas"]["TaskConfig"]
																| undefined;
															const ans = answersMap[String(task.id)] as
																| TaskAnswer
																| undefined;
															const mapChoiceLabel = (val: string): string => {
																let options: string[] | undefined;
																if (cfg && "options" in cfg) {
																	options = cfg.options;
																}
																const idx = Number(val);
																if (
																	options &&
																	Number.isInteger(idx) &&
																	idx >= 0 &&
																	idx < options.length
																)
																	return options[idx] ?? val;
																return val;
															};
															return (
																<div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
																	<div className="flex items-center justify-between">
																		<div className="font-medium text-slate-300">
																			{meta?.title ??
																				dto?.title ??
																				`Task #${currentTaskIdx + 1}`}
																		</div>
																		<div className="text-slate-300 text-xs">
																			{meta?.points ?? Number(dto?.points ?? 0)}{" "}
																			{t(
																				getPointsPlural(
																					meta?.points ??
																						Number(dto?.points ?? 0),
																				),
																			) || "pts"}
																		</div>
																	</div>
																	{dto?.description ? (
																		<div className="mt-2 rounded-md border border-slate-800 bg-slate-900/30 p-2">
																			<div className="mb-1 text-slate-300 text-xs">
																				{t("task_description")}
																			</div>
																			<Markdown
																				content={dto.description}
																				className="markdown-body max-w-none text-slate-200 text-sm"
																			/>
																		</div>
																	) : null}
																	<div className="mt-2 rounded-md border border-slate-800 bg-slate-900/30 p-2">
																		<div className="mb-1 text-slate-300 text-xs">
																			{t("user_answer")}
																		</div>
																		{ans ? (
																			ans.name === "single_choice" ? (
																				<div className="break-words text-slate-200 text-sm">
																					{ans.answer
																						? mapChoiceLabel(ans.answer)
																						: "(empty)"}
																				</div>
																			) : ans.name === "multiple_choice" ? (
																				(() => {
																					// Narrow to multiple_choice variant
																					const multi = ans as Extract<
																						TaskAnswer,
																						{ name: "multiple_choice" }
																					>;
																					const arr = Array.isArray(
																						multi.answers,
																					)
																						? multi.answers
																						: [];
																					const mapped =
																						arr.map(mapChoiceLabel);
																					return mapped.length > 0 ? (
																						<ul className="list-disc pl-5 text-slate-200 text-sm">
																							{mapped.map((s) => (
																								<li
																									key={s}
																									className="break-words"
																								>
																									{s}
																								</li>
																							))}
																						</ul>
																					) : (
																						<div className="text-slate-400 text-sm">
																							(no selection)
																						</div>
																					);
																				})()
																			) : ans.name === "short_text" ||
																				ans.name === "long_text" ? (
																				<pre className="whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/40 p-2 text-slate-200 text-sm">
																					{ans.answer || ""}
																				</pre>
																			) : ans.name === "ordering" ? (
																				(() => {
																					// Narrow cfg to ordering variant for items
																					const items =
																						cfg && "items" in cfg
																							? cfg.items
																							: [];
																					// Narrow ans to ordering variant
																					const ord = ans as Extract<
																						TaskAnswer,
																						{ name: "ordering" }
																					>;
																					let arr = Array.isArray(ord.answer)
																						? ord.answer
																						: [];
																					if (arr.length && items.length) {
																						arr = arr.map((v) => {
																							const idx = Number(v);
																							if (
																								Number.isInteger(idx) &&
																								idx >= 0 &&
																								idx < items.length
																							)
																								return items[idx] ?? v;
																							return v;
																						});
																					}
																					return arr.length > 0 ? (
																						<ol className="list-decimal pl-5 text-slate-200 text-sm">
																							{arr.map((s) => (
																								<li
																									key={s}
																									className="break-words"
																								>
																									{s}
																								</li>
																							))}
																						</ol>
																					) : (
																						<div className="text-slate-400 text-sm">
																							(no ordering)
																						</div>
																					);
																				})()
																			) : ans.name === "file_upload" ? (
																				<div className="text-slate-200 text-sm">
																					File uploaded:{" "}
																					<code className="text-slate-300">
																						{ans.file_id ?? "unknown"}
																					</code>
																				</div>
																			) : ans.name === "ctfd" ? (
																				<div className="text-slate-200 text-sm">
																					CTFd task. Check platform.
																				</div>
																			) : (
																				<div className="text-slate-400 text-sm">
																					Unsupported answer
																				</div>
																			)
																		) : (
																			<div className="text-slate-400 text-sm">
																				{t("no_answer")}
																			</div>
																		)}
																	</div>
																	<div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
																		<div>
																			<label
																				className="text-slate-300 text-xs"
																				htmlFor={`verdict-${task.id}`}
																			>
																				{t("verdict")}
																			</label>
																			<Select
																				value={name}
																				onValueChange={(val) =>
																					onChangeVerdict(
																						task.id,
																						val as TaskVerdict["verdict"],
																					)
																				}
																			>
																				<SelectTrigger
																					id={`verdict-${task.id}`}
																					className="w-full border-slate-700 bg-slate-900 text-slate-100"
																				>
																					<SelectValue />
																				</SelectTrigger>
																				<SelectContent className="border border-slate-800 bg-slate-900 text-slate-100">
																					<SelectItem value="on_review">
																						{t("on_review")}
																					</SelectItem>
																					<SelectItem value="incorrect">
																						{t("incorrect")}
																					</SelectItem>
																					<SelectItem value="partial_score">
																						{t("partially_correct")}
																					</SelectItem>
																					<SelectItem value="full_score">
																						{t("correct")}
																					</SelectItem>
																				</SelectContent>
																			</Select>
																		</div>
																		{v.verdict !== "on_review" &&
																		v.verdict !== "incorrect" &&
																		v.verdict !== "full_score" ? (
																			<div>
																				<label
																					className="text-slate-300 text-xs"
																					htmlFor={`score-${task.id}`}
																				>
																					{t("score")} (0..
																					{meta?.points ??
																						Number(dto?.points ?? 0)}
																					)
																				</label>
																				<Input
																					id={`score-${task.id}`}
																					type="number"
																					value={v.score}
																					min={0}
																					max={
																						meta?.points ??
																						Number(dto?.points ?? 0)
																					}
																					step={1}
																					className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
																					onChange={(e) =>
																						onChangeScore(
																							task.id,
																							Number(e.target.value),
																						)
																					}
																				/>
																			</div>
																		) : null}
																		{v.verdict !== "on_review" ? (
																			<div className="md:col-span-3">
																				<label
																					className="text-slate-300 text-xs"
																					htmlFor={`comment-${task.id}`}
																				>
																					{t("comment")}
																				</label>
																				<Textarea
																					id={`comment-${task.id}`}
																					value={v.comment ?? ""}
																					className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400"
																					onChange={(e) =>
																						onChangeComment(
																							task.id,
																							e.target.value,
																						)
																					}
																				/>
																			</div>
																		) : null}
																	</div>
																	<div className="mt-4 flex items-center justify-between">
																		<Button
																			variant="outline"
																			className="border-slate-700 text-white hover:bg-slate-800"
																			onClick={() =>
																				setCurrentTaskIdx((i) =>
																					Math.max(0, i - 1),
																				)
																			}
																			disabled={currentTaskIdx === 0}
																		>
																			{t("previous")}
																		</Button>
																		<div className="text-sm">
																			{t("task")} {currentTaskIdx + 1} /{" "}
																			{taskEntities.length}
																		</div>
																		<Button
																			variant="outline"
																			className="border-slate-700 text-white hover:bg-slate-800"
																			onClick={() =>
																				setCurrentTaskIdx((i) =>
																					Math.min(
																						taskEntities.length - 1,
																						i + 1,
																					),
																				)
																			}
																			disabled={
																				currentTaskIdx >=
																				taskEntities.length - 1
																			}
																		>
																			{t("next")}
																		</Button>
																	</div>
																</div>
															);
														})()}
													</div>
												</div>
											</CardContent>
										</Card>

										<div className="flex justify-end">
											<Button
												onClick={saveChanges}
												disabled={saving}
												className="bg-red-600 text-white hover:bg-red-700"
											>
												<Save className="mr-1 h-4 w-4" />
												{t("save_changes")}
											</Button>
										</div>
									</>
								) : (
									<div className="text-slate-300 text-sm">
										Select an attempt to review
									</div>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
		</>
	);
}
