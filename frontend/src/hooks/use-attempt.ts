import {
	type ExamAttempt,
	type ExamAttemptsListDTO,
	type PublicTaskDTO,
	getExamTasks,
	getUserExamAttempts,
	patchAttempt,
	startAttempt,
	stopAttempt,
} from "@/api/exam";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface UseAttemptResult {
	attempt: ExamAttempt | null;
	isPreview: boolean;
	tasks: PublicTaskDTO[];
	loading: boolean;
	taskIndex: number;
	setTaskIndex: (index: number) => void;
	start: () => void;
	stop: () => void;
	starting: boolean;
	stopping: boolean;
	patchProgress: (body: unknown) => void;
	patching: boolean;
	refresh: () => void;
	noMoreAttempts: boolean;
	flushNow: () => Promise<void>;
	attemptsLeft?: number;
	ranOut?: boolean;
}

export function useAttempt(
	examId: string | null,
	isStaff: boolean,
	triesCount?: number,
): UseAttemptResult {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const qc = useQueryClient();

	const [taskIndex, setTaskIndex] = useState(0);
	const [noMoreAttempts, setNoMoreAttempts] = useState(false);

	useEffect(() => {
		void examId;
		setNoMoreAttempts(false);
	}, [examId]);

	const attemptsListQuery = useQuery({
		queryKey: ["exam", examId, "attempts-list"],
		queryFn: async (): Promise<ExamAttemptsListDTO> => {
			if (!examId) throw new Error("no examId");
			return await getUserExamAttempts(examId);
		},
		enabled: !!examId,
		retry: false,
	});

	const tasksQuery = useQuery({
		queryKey: ["exam", examId, "tasks"],
		queryFn: async () => {
			if (!examId) throw new Error("no examId");
			const list = await getExamTasks(examId);
			return list ?? [];
		},
		enabled: !!examId,
		retry: false,
	});

	const attempt: ExamAttempt | null = (() => {
		const list = attemptsListQuery.data?.attempts ?? [];
		if (list.length === 0) return null;
		const sorted = [...list].sort(
			(a, b) =>
				new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
		);
		return sorted[0] ?? null;
	})();
	const tasks = tasksQuery.data ?? [];
	const isPreview = isStaff && (!attempt || !attempt.active);
	const loading = attemptsListQuery.isLoading || tasksQuery.isLoading;

	/* biome-ignore lint/correctness/useExhaustiveDependencies: we intentionally reset when examId changes */
	useEffect(() => {
		setTaskIndex(0);
	}, [examId, tasks.length]);

	const startAttemptMutation = useMutation({
		mutationFn: async () => {
			if (!examId) throw new Error("no examId");
			return await startAttempt(examId);
		},
		onSuccess: async (att) => {
			await Promise.all([
				qc.invalidateQueries({ queryKey: ["exam", examId, "attempts-list"] }),
				qc.invalidateQueries({ queryKey: ["exam", examId, "tasks"] }),
			]);
			setTaskIndex(0);
		},
		onError: async (err: unknown) => {
			const { msg } = ((): { msg?: string } => {
				try {
					if (typeof err === "object" && err) {
						const e = err as Record<string, unknown>;
						const message =
							typeof e.message === "string" ? e.message : undefined;
						const error = typeof e.error === "string" ? e.error : undefined;
						const response = e.response as
							| { data?: { error?: unknown } }
							| undefined;
						const respError =
							response && typeof response.data?.error === "string"
								? (response.data.error as string)
								: undefined;
						return { msg: message ?? error ?? respError };
					}
				} catch {}
				return {};
			})();

			await qc.invalidateQueries({
				queryKey: ["exam", examId, "attempts-list"],
			});
			await qc.invalidateQueries({ queryKey: ["exam", examId, "tasks"] });

			toast({
				description: msg ?? (t("failed_operation") || "Operation failed"),
			});
		},
	});

	const stopAttemptMutation = useMutation({
		mutationFn: async () => {
			if (!examId) throw new Error("no examId");
			return await stopAttempt(examId);
		},
		onSuccess: async () => {
			await qc.invalidateQueries({
				queryKey: ["exam", examId, "attempts-list"],
			});
		},
		onError: () => {
			toast({ description: t("failed_operation") || "Operation failed" });
		},
	});

	const [patching, setPatching] = useState(false);
	const queueRef = useRef<unknown[]>([]);
	const timerRef = useRef<number | null>(null);

	const flush = useCallback(async () => {
		const items = queueRef.current;
		queueRef.current = [];
		if (items.length === 0 || !examId) return;
		setPatching(true);
		try {
			for (const body of items) {
				await patchAttempt(examId, body);
			}
		} finally {
			setPatching(false);
		}
	}, [examId]);

	const patchProgress = useCallback(
		(body: unknown) => {
			queueRef.current.push(body);
			if (timerRef.current) window.clearTimeout(timerRef.current);

			timerRef.current = window.setTimeout(() => {
				flush();
				timerRef.current = null;
			}, 500);
		},
		[flush],
	);

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			void flush();
		};
	}, [flush]);

	const flushNow = useCallback(async () => {
		if (timerRef.current) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		await flush();
	}, [flush]);

	const start = useCallback(() => {
		if (!examId || startAttemptMutation.isPending) return;
		startAttemptMutation.mutate();
	}, [examId, startAttemptMutation]);

	const stop = useCallback(() => {
		if (!examId || stopAttemptMutation.isPending) return;
		stopAttemptMutation.mutate();
	}, [examId, stopAttemptMutation]);

	const refresh = useCallback(() => {
		if (!examId) return;
		qc.invalidateQueries({ queryKey: ["exam", examId, "attempts-list"] });
		qc.invalidateQueries({ queryKey: ["exam", examId, "tasks"] });
	}, [qc, examId]);

	useEffect(() => {
		if (isStaff) {
			setNoMoreAttempts(false);
			return;
		}
		const ranOut = attemptsListQuery.data?.ran_out_of_attempts ?? false;
		const left = attemptsListQuery.data?.attempts_left;
		if (ranOut || (typeof left === "number" && left <= 0)) {
			setNoMoreAttempts(true);
		} else {
			setNoMoreAttempts(false);
		}
	}, [
		isStaff,
		attemptsListQuery.data?.ran_out_of_attempts,
		attemptsListQuery.data?.attempts_left,
	]);

	return useMemo(
		() => ({
			attempt,
			isPreview,
			tasks,
			loading,
			taskIndex,
			setTaskIndex,
			start,
			stop,
			starting: startAttemptMutation.isPending,
			stopping: stopAttemptMutation.isPending,
			patchProgress,
			patching,
			refresh,
			noMoreAttempts,
			flushNow,
			attemptsLeft: attemptsListQuery.data?.attempts_left,
			ranOut: attemptsListQuery.data?.ran_out_of_attempts,
		}),
		[
			attempt,
			isPreview,
			tasks,
			loading,
			taskIndex,
			start,
			stop,
			startAttemptMutation.isPending,
			stopAttemptMutation.isPending,
			patchProgress,
			patching,
			refresh,
			noMoreAttempts,
			flushNow,
			attemptsListQuery.data?.attempts_left,
			attemptsListQuery.data?.ran_out_of_attempts,
		],
	);
}
