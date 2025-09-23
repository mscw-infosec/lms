"use client";

import type { ExamEntity, PubExamExtendedEntity, TextEntity } from "@/api/exam";
import {
	createText,
	deleteText,
	updateExamEntities,
	updateText,
} from "@/api/exam";
import type { PublicTaskDTO } from "@/api/tasks";
import { getTaskById } from "@/api/tasks";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
	ArrowDown,
	ArrowUp,
	Check,
	FileText,
	ListChecks,
	Pencil,
	Plus,
	Save,
	Trash2,
	X as XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function safeRandomId(): string {
	const c = globalThis.crypto as Crypto | undefined;
	if (c && "randomUUID" in c) {
		return c.randomUUID();
	}
	return Math.random().toString(36).slice(2);
}

export type DraftItem =
	| { uid: string; type: "task"; task: PublicTaskDTO }
	| { uid: string; type: "text"; text: TextEntity };

interface EditExamDialogProps {
	examId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entities: PubExamExtendedEntity[];
	onSaved?: () => void;
}

export default function EditExamDialog({
	examId,
	open,
	onOpenChange,
	entities,
	onSaved,
}: EditExamDialogProps) {
	const { t } = useTranslation("common");
	const { toast } = useToast();

	const initial: DraftItem[] = useMemo(() => {
		const list: DraftItem[] = [];
		let i = 0;
		for (const e of entities ?? []) {
			if ((e as { type?: string }).type === "task") {
				const t = (e as { task: PublicTaskDTO }).task;
				list.push({ uid: `task-${t.id}-${i++}`, type: "task", task: t });
			} else if ((e as { type?: string }).type === "text") {
				const txt = (e as { text: TextEntity }).text as TextEntity;
				list.push({ uid: `text-${txt.id}-${i++}`, type: "text", text: txt });
			}
		}
		return list;
	}, [entities]);

	const [items, setItems] = useState<DraftItem[]>(initial);
	const [busy, setBusy] = useState<
		null | "save" | "add-task" | "add-text" | "edit-text" | "delete-text"
	>(null);
	const [taskIdInput, setTaskIdInput] = useState<string>("");
	const [newText, setNewText] = useState<string>("");
	const [editIdx, setEditIdx] = useState<number | null>(null);
	const [editTextVal, setEditTextVal] = useState<string>("");

	// Reset local draft when dialog opens/closes or entities change
	useEffect(() => {
		if (!open) return;
		setItems(initial);
		setTaskIdInput("");
		setNewText("");
		setEditIdx(null);
		setEditTextVal("");
	}, [open, initial]);

	const move = (uid: string, dir: -1 | 1) => {
		let idx = -1;
		let j = -1;
		setItems((prev) => {
			const next = [...prev];
			idx = next.findIndex((x) => x.uid === uid);
			if (idx === -1) return prev;
			j = idx + dir;
			if (j < 0 || j >= next.length) return prev;
			const a = next[idx];
			const b = next[j];
			if (!a || !b) return prev;
			next[idx] = b;
			next[j] = a;
			return next;
		});
		setEditIdx((prevIdx) => {
			if (prevIdx === null) return prevIdx;
			if (prevIdx === idx) return j;
			if (prevIdx === j) return idx;
			return prevIdx;
		});
	};

	const removeAt = (idx: number) => {
		setItems((prev) => prev.filter((_, i) => i !== idx));
		setEditIdx((prevIdx) => {
			if (prevIdx === null) return prevIdx;
			if (prevIdx === idx) return null;
			if (prevIdx > idx) return prevIdx - 1;
			return prevIdx;
		});
	};

	const onAddTask = async () => {
		const idNum = Number(taskIdInput);
		if (!Number.isFinite(idNum) || idNum <= 0) {
			toast({
				description: t("invalid_id") ?? "Invalid ID",
				variant: "destructive",
			});
			return;
		}
		try {
			setBusy("add-task");
			const task = await getTaskById(idNum);
			// prevent duplicates of the same task id
			setItems((prev) => {
				if (prev.some((x) => x.type === "task" && x.task.id === task.id))
					return prev;
				const uid = `task-${task.id}-${safeRandomId()}`;
				return [...prev, { uid, type: "task", task }];
			});
			setTaskIdInput("");
		} catch (e) {
			console.error(e);
			toast({
				description: t("failed_operation") ?? "Operation failed",
				variant: "destructive",
			});
		} finally {
			setBusy(null);
		}
	};

	const onAddText = async () => {
		const txt = newText.trim();
		if (!txt) return;
		try {
			setBusy("add-text");
			const created = await createText({ text: txt });
			setItems((prev) => {
				const uid = `text-${created.id}-${safeRandomId()}`;
				return [...prev, { uid, type: "text", text: created }];
			});
			setNewText("");
		} catch (e) {
			console.error(e);
			toast({
				description: t("failed_operation") ?? "Operation failed",
				variant: "destructive",
			});
		} finally {
			setBusy(null);
		}
	};

	const onStartEditText = (idx: number) => {
		const item = items[idx];
		if (!item || item.type !== "text") return;
		setEditIdx(idx);
		setEditTextVal(item.text.text);
	};

	const onCancelEditText = () => {
		setEditIdx(null);
		setEditTextVal("");
	};

	const onSaveEditText = async () => {
		if (editIdx === null) return;
		const item = items[editIdx];
		if (!item || item.type !== "text") return;
		try {
			setBusy("edit-text");
			const updated = await updateText(item.text.id, { text: editTextVal });
			setItems((prev) => {
				const next = [...prev];
				const prevItem = next[editIdx];
				if (!prevItem) return prev;
				next[editIdx] = { uid: prevItem.uid, type: "text", text: updated };
				return next;
			});
			setEditIdx(null);
			setEditTextVal("");
		} catch (e) {
			console.error(e);
			toast({
				description: t("failed_operation") ?? "Operation failed",
				variant: "destructive",
			});
		} finally {
			setBusy(null);
		}
	};

	const onDeleteText = async (idx: number) => {
		const item = items[idx];
		if (!item || item.type !== "text") return;
		if (!confirm(t("are_you_sure") ?? "Are you sure?")) return;
		try {
			setBusy("delete-text");
			await deleteText(item.text.id);
			removeAt(idx);
		} catch (e) {
			console.error(e);
			toast({
				description: t("failed_operation") ?? "Operation failed",
				variant: "destructive",
			});
		} finally {
			setBusy(null);
		}
	};

	const onSave = async () => {
		try {
			setBusy("save");
			const payload: ExamEntity[] = items.map((it) =>
				it.type === "task"
					? ({ name: "task", id: it.task.id } as ExamEntity)
					: ({ name: "text", id: it.text.id } as ExamEntity),
			);
			await updateExamEntities(examId, payload);
			toast({ description: t("saved") ?? "Saved" });
			onSaved?.();
			onOpenChange(false);
		} catch (e) {
			console.error(e);
			toast({
				description: t("failed_operation") ?? "Operation failed",
				variant: "destructive",
			});
		} finally {
			setBusy(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200 sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{t("edit_exam") ?? "Edit exam"}</DialogTitle>
					<DialogDescription>
						{t("edit_exam_help") ??
							"Manage exam items: add tasks, add/edit texts, remove and reorder them."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						{items.length === 0 ? (
							<div className="text-slate-400 text-sm">
								{t("no_tasks_attached") ?? "No items yet."}
							</div>
						) : (
							items.map((it, idx) => (
								<div
									key={it.uid}
									className="flex items-start justify-between rounded-md border border-slate-800 bg-slate-800/50 p-3"
								>
									<div className="flex-1 pr-2">
										{it.type === "task" ? (
											<div className="flex items-center gap-2">
												<ListChecks className="h-4 w-4 text-purple-400" />
												<div>
													<div className="font-medium text-white">
														{it.task.title}
													</div>
													<div className="text-slate-400 text-xs">
														ID: {it.task.id} · {t("points_other") ?? "Points"}:{" "}
														{it.task.points}
													</div>
												</div>
											</div>
										) : editIdx === idx ? (
											<div className="w-full">
												<div className="mb-2 flex items-center gap-2 text-slate-300 text-sm">
													<FileText className="h-4 w-4" />
													<span>{t("text") ?? "Text"}</span>
												</div>
												<Textarea
													value={editTextVal}
													onChange={(e) => setEditTextVal(e.target.value)}
													className="min-h-24 w-full border-slate-700 bg-slate-800 text-slate-100"
												/>
											</div>
										) : (
											<div>
												<div className="mb-1 flex items-center gap-2 text-slate-300 text-sm">
													<FileText className="h-4 w-4" />
													<span>{t("text") ?? "Text"}</span>
												</div>
												<div className="whitespace-pre-wrap text-slate-200 text-sm">
													{it.text.text}
												</div>
												<div className="mt-1 text-slate-500 text-xs">
													ID: {it.text.id}
												</div>
											</div>
										)}
									</div>

									<div className="flex flex-col items-end gap-2 sm:flex-row">
										<div className="flex gap-1">
											<Button
												variant="outline"
												size="icon"
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
												onClick={() => move(it.uid, -1)}
												disabled={idx === 0 || busy === "save"}
												title={t("move_up") ?? "Move up"}
											>
												<ArrowUp className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="icon"
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
												onClick={() => move(it.uid, 1)}
												disabled={idx === items.length - 1 || busy === "save"}
												title={t("move_down") ?? "Move down"}
											>
												<ArrowDown className="h-4 w-4" />
											</Button>
										</div>

										{it.type === "text" && editIdx !== idx ? (
											<Button
												variant="outline"
												size="icon"
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
												onClick={() => onStartEditText(idx)}
												disabled={busy === "edit-text"}
												title={t("edit") ?? "Edit"}
											>
												<Pencil className="h-4 w-4" />
											</Button>
										) : null}

										{it.type === "text" && editIdx === idx ? (
											<div className="flex gap-1">
												<Button
													size="icon"
													className="bg-red-600 text-white hover:bg-red-700"
													onClick={onSaveEditText}
													disabled={busy === "edit-text"}
													title={t("save") ?? "Save"}
												>
													<Check className="h-4 w-4" />
												</Button>
												<Button
													variant="outline"
													size="icon"
													className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
													onClick={onCancelEditText}
													title={t("cancel") ?? "Cancel"}
												>
													<XIcon className="h-4 w-4" />
												</Button>
											</div>
										) : null}

										<Button
											variant="ghost"
											size="icon"
											className="text-red-400 hover:text-red-300"
											onClick={() =>
												it.type === "text" ? onDeleteText(idx) : removeAt(idx)
											}
											disabled={busy === "delete-text"}
											title={t("delete") ?? "Delete"}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))
						)}
					</div>

					<div className="rounded-md border border-slate-800 bg-slate-800/40 p-3">
						<div className="mb-2 font-medium text-slate-300 text-sm">
							{t("add_task_by_id") ?? "Add task by ID"}
						</div>
						<div className="flex items-center gap-2">
							<Input
								value={taskIdInput}
								onChange={(e) => setTaskIdInput(e.target.value)}
								placeholder={t("task_id") ?? "Task ID"}
								className="w-40 border-slate-700 bg-slate-800 text-white"
							/>
							<Button
								onClick={onAddTask}
								disabled={busy === "add-task"}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								<Plus className="mr-1 h-4 w-4" />
								{t("add_task") ?? "Add task"}
							</Button>
						</div>
					</div>

					<div className="rounded-md border border-slate-800 bg-slate-800/40 p-3">
						<div className="mb-2 font-medium text-slate-300 text-sm">
							{t("create_text") ?? "Create text"}
						</div>
						<Textarea
							value={newText}
							onChange={(e) => setNewText(e.target.value)}
							placeholder={t("enter_text") ?? "Enter text..."}
							className="mb-2 min-h-24 w-full border-slate-700 bg-slate-800 text-slate-100"
						/>
						<Button
							onClick={onAddText}
							disabled={!newText.trim() || busy === "add-text"}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							<Plus className="mr-1 h-4 w-4" />
							{t("add_text") ?? "Add text"}
						</Button>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
						onClick={() => onOpenChange(false)}
					>
						{t("close") ?? "Close"}
					</Button>
					<Button
						onClick={onSave}
						disabled={busy === "save"}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						<Save className="mr-1 h-4 w-4" />
						{t("save") ?? "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
