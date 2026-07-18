"use client";

import { getExamById, updateExam } from "@/api/exam";
import type { components } from "@/api/schema/schema";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type ExamType = components["schemas"]["UpsertExamRequestDTO"]["type"];

function toLocalInput(iso?: string | null): string {
	if (!iso) return "";
	try {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	} catch {
		return "";
	}
}

export default function ExamMetaDialog({
	examId,
	open,
	onOpenChange,
	onSaved,
}: {
	examId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [type, setType] = useState<ExamType>("Instant");
	const [duration, setDuration] = useState(0);
	const [tries, setTries] = useState(1);
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [topicId, setTopicId] = useState(0);

	const examQuery = useQuery({
		queryKey: ["exam", examId],
		queryFn: () => getExamById(examId),
		enabled: open,
		retry: false,
	});

	useEffect(() => {
		const e = examQuery.data;
		if (e) {
			setName(e.name);
			setDescription(e.description ?? "");
			setType(e.type);
			setDuration(e.duration);
			setTries(e.tries_count);
			setStartsAt(toLocalInput(e.starts_at));
			setEndsAt(toLocalInput(e.ends_at));
			setTopicId(e.topic_id);
		}
	}, [examQuery.data]);

	const saveMutation = useMutation({
		mutationFn: () =>
			updateExam(examId, {
				name: name.trim(),
				description: description.trim() || undefined,
				type,
				duration: Number(duration) || 0,
				tries_count: Number(tries) || 0,
				topic_id: topicId,
				starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
				ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
			}),
		onSuccess: () => {
			toast({ description: t("saved_successfully") || "Saved" });
			onSaved?.();
			onOpenChange(false);
		},
		onError: () => toast({ description: t("save_failed") || "Failed to save" }),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200">
				<DialogHeader>
					<DialogTitle>{t("edit_exam") || "Edit exam"}</DialogTitle>
				</DialogHeader>
				{examQuery.isLoading ? (
					<div className="flex items-center gap-2 p-4 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : (
					<div className="space-y-3">
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("exam_name") || "Exam name"}
							</Label>
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("exam_description") || "Description"}
							</Label>
							<Textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="min-h-20 border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div>
								<Label className="text-slate-300">
									{t("exam_type") || "Type"}
								</Label>
								<Select
									value={type}
									onValueChange={(v: ExamType) => setType(v)}
								>
									<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-slate-700 bg-slate-800 text-slate-200">
										<SelectItem value="Instant">
											{t("exam_type_instant") || "Instant"}
										</SelectItem>
										<SelectItem value="Delayed">
											{t("exam_type_delayed") || "Delayed"}
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label className="text-slate-300">
									{t("duration_seconds") || "Duration (sec)"}
								</Label>
								<Input
									type="number"
									min={0}
									value={duration}
									onChange={(e) => setDuration(Number(e.target.value))}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div>
								<Label className="text-slate-300">
									{t("tries_count") || "Tries"}
								</Label>
								<Input
									type="number"
									min={0}
									value={tries}
									onChange={(e) => setTries(Number(e.target.value))}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="flex flex-col gap-1">
								<Label className="text-slate-300">
									{t("starts_at") || "Starts at (optional)"}
								</Label>
								<Input
									type="datetime-local"
									value={startsAt}
									onChange={(e) => setStartsAt(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label className="text-slate-300">
									{t("ends_at") || "Ends at (optional)"}
								</Label>
								<Input
									type="datetime-local"
									value={endsAt}
									onChange={(e) => setEndsAt(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
					</div>
				)}
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="text-slate-300 hover:bg-slate-800"
					>
						{t("cancel") || "Cancel"}
					</Button>
					<Button
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending || !name.trim()}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						{saveMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						{t("save") || "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
