"use client";

import { getLectureNote, saveLectureNote } from "@/api/lectures";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatTimecode, splitByTimecodes } from "@/lib/timecode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDown,
	Clock,
	Loader2,
	NotebookPen,
	TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const MAX_LENGTH = 20000;

interface LectureNotesProps {
	lectureId: number;
	canSeek: boolean;
	onSeek: (seconds: number) => void;
	getTime: () => number;
	duration: number | null;
}

export default function LectureNotes({
	lectureId,
	canSeek,
	onSeek,
	getTime,
	duration,
}: LectureNotesProps) {
	const { t } = useTranslation("common");
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const noteQuery = useQuery({
		queryKey: ["lecture-note", lectureId],
		queryFn: () => getLectureNote(lectureId),
		retry: false,
		refetchOnWindowFocus: false,
	});

	const saveMutation = useMutation({
		mutationFn: (content: string) => saveLectureNote(lectureId, content),
		onSuccess: (note) => {
			queryClient.setQueryData(["lecture-note", lectureId], note);
			setEditing(false);
		},
	});

	const saved = noteQuery.data?.content ?? "";
	const parts = useMemo(() => splitByTimecodes(saved), [saved]);

	const dirty = editing && draft !== saved;
	const beyond = (seconds: number) => duration !== null && seconds > duration;
	const beyondInDraft = useMemo(() => {
		const values = splitByTimecodes(draft).flatMap((part) =>
			part.kind === "timecode" && duration !== null && part.seconds > duration
				? [part.value]
				: [],
		);
		return [...new Set(values)];
	}, [draft, duration]);

	useEffect(() => {
		if (!notice) return;
		const timer = window.setTimeout(() => setNotice(null), 5000);
		return () => window.clearTimeout(timer);
	}, [notice]);

	useEffect(() => {
		if (editing) textareaRef.current?.focus();
	}, [editing]);

	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const startEditing = () => {
		setDraft(saved);
		setNotice(null);
		saveMutation.reset();
		setEditing(true);
	};

	const insertTimecode = () => {
		const field = textareaRef.current;
		const stamp = `${formatTimecode(getTime())} `;
		const start = field?.selectionStart ?? draft.length;
		const end = field?.selectionEnd ?? draft.length;
		const next = `${draft.slice(0, start)}${stamp}${draft.slice(end)}`;
		if (next.length > MAX_LENGTH) return;

		setDraft(next);
		requestAnimationFrame(() => {
			field?.focus();
			field?.setSelectionRange(start + stamp.length, start + stamp.length);
		});
	};

	return (
		<Card className="border-slate-800 bg-slate-900">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="flex w-full items-center justify-between gap-2 p-4 text-left"
			>
				<span className="flex items-center gap-2 font-semibold text-lg text-white">
					<NotebookPen className="h-4 w-4 text-sky-400" />
					{t("lecture_notes")}
					{saved && !open ? (
						<span className="h-2 w-2 rounded-full bg-sky-400">
							<span className="sr-only">{t("lecture_notes_has_note")}</span>
						</span>
					) : null}
				</span>
				<ChevronDown
					className={`h-4 w-4 text-slate-400 transition-transform ${
						open ? "rotate-180" : ""
					}`}
				/>
			</button>

			{open ? (
				<CardContent className="space-y-3 pt-0">
					<p className="text-slate-400 text-xs">{t("lecture_notes_private")}</p>

					{noteQuery.isLoading ? (
						<Loader2 className="h-4 w-4 animate-spin text-slate-400" />
					) : noteQuery.isError ? (
						<p className="text-red-400 text-sm">{t("notes_load_failed")}</p>
					) : editing ? (
						<div className="space-y-3">
							<Textarea
								ref={textareaRef}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								maxLength={MAX_LENGTH}
								rows={7}
								aria-label={t("lecture_notes")}
								placeholder={t("lecture_notes_placeholder")}
								className="resize-y border-slate-700 bg-slate-950 text-slate-200"
							/>
							<div className="flex items-center justify-between gap-2">
								{canSeek ? (
									<button
										type="button"
										onClick={insertTimecode}
										className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-slate-300 text-xs transition-colors hover:bg-slate-800"
									>
										<Clock className="h-3.5 w-3.5" />
										{t("notes_insert_timecode")}
									</button>
								) : (
									<span />
								)}
								<span className="text-slate-500 text-xs">
									{draft.length} / {MAX_LENGTH}
								</span>
							</div>
							{beyondInDraft.length > 0 && duration !== null ? (
								<Alert className="border-amber-600/40 bg-amber-950/30 text-amber-200 [&>svg]:text-amber-400">
									<TriangleAlert className="h-4 w-4" />
									<AlertTitle>{t("notes_timecode_beyond_title")}</AlertTitle>
									<AlertDescription>
										{t("notes_timecode_beyond", {
											times: beyondInDraft.join(", "),
											duration: formatTimecode(duration),
										})}
									</AlertDescription>
								</Alert>
							) : null}
							{saveMutation.isError ? (
								<p className="text-red-400 text-sm">{t("notes_save_failed")}</p>
							) : null}
							<div className="flex justify-end gap-2">
								<Button
									variant="ghost"
									size="sm"
									className="text-slate-300 hover:text-white"
									disabled={saveMutation.isPending}
									onClick={() => setEditing(false)}
								>
									{t("cancel")}
								</Button>
								<Button
									size="sm"
									className="bg-sky-600 text-white hover:bg-sky-700"
									disabled={saveMutation.isPending || draft === saved}
									onClick={() => saveMutation.mutate(draft)}
								>
									{saveMutation.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : null}
									{t("save")}
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							{saved ? (
								<div className="whitespace-pre-wrap break-words text-slate-200 text-sm">
									{parts.map((part) =>
										part.kind === "timecode" && canSeek ? (
											beyond(part.seconds) && duration !== null ? (
												<button
													type="button"
													key={part.start}
													onClick={() => setNotice(part.value)}
													title={t("notes_timecode_beyond_hint", {
														duration: formatTimecode(duration),
													})}
													className="rounded font-mono text-amber-400 line-through decoration-amber-400/60 transition-colors hover:text-amber-300"
												>
													{part.value}
												</button>
											) : (
												<button
													type="button"
													key={part.start}
													onClick={() => onSeek(part.seconds)}
													className="rounded font-mono text-sky-400 underline decoration-sky-400/40 underline-offset-2 transition-colors hover:text-sky-300"
												>
													{part.value}
												</button>
											)
										) : (
											<span key={part.start}>{part.value}</span>
										),
									)}
								</div>
							) : (
								<p className="text-slate-500 text-sm">{t("notes_empty")}</p>
							)}
							{notice && duration !== null ? (
								<Alert className="border-amber-600/40 bg-amber-950/30 text-amber-200 [&>svg]:text-amber-400">
									<TriangleAlert className="h-4 w-4" />
									<AlertTitle>{t("notes_timecode_beyond_title")}</AlertTitle>
									<AlertDescription>
										{t("notes_timecode_beyond", {
											times: notice,
											duration: formatTimecode(duration),
										})}
									</AlertDescription>
								</Alert>
							) : null}
							<div className="flex justify-end">
								<Button
									variant="outline"
									size="sm"
									className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
									onClick={startEditing}
								>
									{saved ? t("edit") : t("notes_add")}
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			) : null}
		</Card>
	);
}
