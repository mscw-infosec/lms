"use client";

import { createExam } from "@/api/exam";
import type { components } from "@/api/schema/schema";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { useToast } from "@/components/ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// Types from schema
type UpsertExamRequestDTO = components["schemas"]["UpsertExamRequestDTO"];

type Props = {
	topicId: number;
	triggerClassName?: string;
	onCreatedExam?: (exam: {
		id: string;
		type: UpsertExamRequestDTO["type"];
		duration: number;
		tries_count: number;
	}) => void;
};

export default function CreateTopicItemDialog({
	topicId,
	triggerClassName,
	onCreatedExam,
}: Props) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const [open, setOpen] = useState(false);

	const [kind, setKind] = useState<"lecture" | "exam">("lecture");

	const reset = () => {
		setKind("lecture");
		setExamState({
			type: "Instant",
			duration: 30,
			tries_count: 1,
			topic_id: topicId,
		});
	};

	const [examState, setExamState] = useState<UpsertExamRequestDTO>({
		type: "Instant",
		duration: 30,
		tries_count: 1,
		topic_id: topicId,
	});

	const examMutation = useMutation({
		mutationFn: async () => createExam({ ...examState, topic_id: topicId }),
		onSuccess: (res) => {
			if (!res?.id) {
				toast({ description: t("save_failed") || "Failed to save" });
				return;
			}
			toast({ description: t("saved_successfully") || "Saved" });
			onCreatedExam?.({
				id: String(res.id),
				type: examState.type,
				duration: examState.duration,
				tries_count: examState.tries_count,
			});
			setOpen(false);
			reset();
		},
		onError: () => toast({ description: t("save_failed") || "Failed to save" }),
	});

	const canSubmit = () => {
		if (kind === "exam")
			return examState.duration > 0 && examState.tries_count > 0;
		return false;
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={
						triggerClassName ??
							"bg-transparent hover:bg-transparent text-slate-300 hover:text-slate-400"
					}
					aria-label={t("create") || "Create"}
				>
					<Plus className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200">
				<DialogHeader>
					<DialogTitle>{t("create_item") || "Create Item"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex gap-4">
						<div className="flex-1">
							<Label className="text-slate-300">{t("type") || "Type"}</Label>
							<Select
								value={kind}
								onValueChange={(v: "lecture" | "exam") => setKind(v)}
							>
								<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
									<SelectValue
										placeholder={t("select_type") || "Select type"}
									/>
								</SelectTrigger>
								<SelectContent className="border-slate-700 bg-slate-800 text-slate-200">
									<SelectItem value="lecture">{t("lecture") || "Lecture"}</SelectItem>
									<SelectItem value="exam">{t("exam") || "Exam"}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{kind === "exam" ? (
						<div className="space-y-4">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<div>
									<Label className="text-slate-300">
										{t("exam_type") || "Exam Type"}
									</Label>
									<Select
										value={examState.type}
										onValueChange={(v: UpsertExamRequestDTO["type"]) =>
											setExamState((s) => ({ ...s, type: v }))
										}
									>
										<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-800 text-slate-200">
											<SelectItem value="Instant">Instant</SelectItem>
											<SelectItem value="Delayed">Delayed</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-slate-300">
										{t("duration_minutes") || "Duration (min)"}
									</Label>
									<Input
										type="number"
										value={examState.duration}
										onChange={(e) =>
											setExamState((s) => ({
												...s,
												duration: Number(e.target.value),
											}))
										}
										className="border-slate-700 bg-slate-800 text-white"
									/>
								</div>
								<div>
									<Label className="text-slate-300">
										{t("tries_count") || "Tries"}
									</Label>
									<Input
										type="number"
										value={examState.tries_count}
										onChange={(e) =>
											setExamState((s) => ({
												...s,
												tries_count: Number(e.target.value),
											}))
										}
										className="border-slate-700 bg-slate-800 text-white"
									/>
								</div>
							</div>
						</div>
					) : (
						<div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-slate-300">
							<div className="text-sm font-medium">{t("lecture") || "Lecture"}</div>
							<div className="text-xs text-slate-400">
								{t("tbd_placeholder") || "Lecture creation is coming soon (TBD)."}
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="mt-4">
					<Button
						variant="ghost"
						onClick={() => setOpen(false)}
						className="text-slate-300 hover:bg-slate-800"
					>
						{t("cancel") || "Cancel"}
					</Button>
					<Button
						onClick={() => (kind === "exam" ? examMutation.mutate() : undefined)}
						disabled={!canSubmit() || examMutation.isPending}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						{examMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						{t("create") || "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
