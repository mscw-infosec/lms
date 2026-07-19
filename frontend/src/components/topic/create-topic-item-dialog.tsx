"use client";

import { createExam } from "@/api/exam";
import { createLecture } from "@/api/lectures";
import { createPractice } from "@/api/practice";
import type { components } from "@/api/schema/schema";
import { createTopicText } from "@/api/topics";
import VideoUploadField from "@/components/topic/video-upload-field";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type UpsertExamRequestDTO = components["schemas"]["UpsertExamRequestDTO"];
type ItemKind = "lecture" | "exam" | "practice" | "text";

type Props = {
	topicId: number;
	triggerClassName?: string;
	/** Called after any item is created, so the parent can refresh its content. */
	onChanged?: () => void;
};

export default function CreateTopicItemDialog({
	topicId,
	triggerClassName,
	onChanged,
}: Props) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<ItemKind>("lecture");

	// Lecture
	const [lectureTitle, setLectureTitle] = useState("");
	const [lectureDescription, setLectureDescription] = useState("");
	const [lectureContent, setLectureContent] = useState("");
	const [lectureVideoId, setLectureVideoId] = useState("");

	// Practice
	const [practiceTitle, setPracticeTitle] = useState("");
	const [practiceDescription, setPracticeDescription] = useState("");

	// Text
	const [textTitle, setTextTitle] = useState("");
	const [textContent, setTextContent] = useState("");

	// Exam
	const [examState, setExamState] = useState<UpsertExamRequestDTO>({
		name: "",
		description: "",
		type: "Instant",
		duration: 30,
		tries_count: 1,
		topic_id: topicId,
	});
	const [startsAtLocal, setStartsAtLocal] = useState("");
	const [endsAtLocal, setEndsAtLocal] = useState("");

	const reset = () => {
		setKind("lecture");
		setLectureTitle("");
		setLectureDescription("");
		setLectureContent("");
		setLectureVideoId("");
		setPracticeTitle("");
		setPracticeDescription("");
		setTextTitle("");
		setTextContent("");
		setExamState({
			name: "",
			description: "",
			type: "Instant",
			duration: 30,
			tries_count: 1,
			topic_id: topicId,
		});
		setStartsAtLocal("");
		setEndsAtLocal("");
	};

	const done = () => {
		toast({ description: t("saved_successfully") || "Saved" });
		onChanged?.();
		setOpen(false);
		reset();
	};
	const fail = (e: unknown) =>
		toast({
			description:
				e instanceof Error ? e.message : t("save_failed") || "Failed to save",
		});

	const lectureMutation = useMutation({
		mutationFn: () =>
			createLecture({
				topic_id: topicId,
				title: lectureTitle.trim(),
				description: lectureDescription.trim() || undefined,
				content: lectureContent.trim() || undefined,
				video_id: lectureVideoId.trim() || undefined,
				order_index: 0,
			}),
		onSuccess: done,
		onError: fail,
	});

	const practiceMutation = useMutation({
		mutationFn: () =>
			createPractice({
				topic_id: topicId,
				title: practiceTitle.trim(),
				description: practiceDescription.trim() || undefined,
				order_index: 0,
			}),
		onSuccess: done,
		onError: fail,
	});

	const textMutation = useMutation({
		mutationFn: () =>
			createTopicText(topicId, textTitle.trim(), textContent.trim()),
		onSuccess: done,
		onError: fail,
	});

	const examMutation = useMutation({
		mutationFn: () =>
			createExam({
				...examState,
				topic_id: topicId,
				starts_at: startsAtLocal
					? new Date(startsAtLocal).toISOString()
					: undefined,
				ends_at: endsAtLocal ? new Date(endsAtLocal).toISOString() : undefined,
				duration: Number(examState.duration),
			}),
		onSuccess: (res) => {
			if (!res?.id) {
				toast({ description: t("save_failed") || "Failed to save" });
				return;
			}
			done();
		},
		onError: fail,
	});

	const canSubmit = () => {
		if (kind === "lecture") return !!lectureTitle.trim();
		if (kind === "practice") return !!practiceTitle.trim();
		if (kind === "text") return !!textTitle.trim() && !!textContent.trim();
		const hasBoth = !!startsAtLocal && !!endsAtLocal;
		const invalidRange = hasBoth
			? new Date(endsAtLocal).getTime() < new Date(startsAtLocal).getTime()
			: false;
		return (
			!!String(examState.name ?? "").trim() &&
			examState.duration >= 0 &&
			examState.tries_count >= 0 &&
			!invalidRange
		);
	};

	const submit = () => {
		if (kind === "lecture") lectureMutation.mutate();
		else if (kind === "practice") practiceMutation.mutate();
		else if (kind === "text") textMutation.mutate();
		else examMutation.mutate();
	};

	const pending =
		lectureMutation.isPending ||
		practiceMutation.isPending ||
		textMutation.isPending ||
		examMutation.isPending;

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
					className={
						triggerClassName ??
						"bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
					}
				>
					<Plus className="mr-2 h-4 w-4" />
					{t("add_item") || "Add item"}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200">
				<DialogHeader>
					<DialogTitle>{t("create_item") || "Create item"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<Label className="text-slate-300">{t("type") || "Type"}</Label>
						<Select value={kind} onValueChange={(v: ItemKind) => setKind(v)}>
							<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
								<SelectValue placeholder={t("select_type") || "Select type"} />
							</SelectTrigger>
							<SelectContent className="border-slate-700 bg-slate-800 text-slate-200">
								<SelectItem value="lecture">
									{t("lecture") || "Lecture"}
								</SelectItem>
								<SelectItem value="text">{t("text") || "Text"}</SelectItem>
								<SelectItem value="practice">
									{t("practice") || "Practice"}
								</SelectItem>
								<SelectItem value="exam">{t("exam") || "Exam"}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{kind === "lecture" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("title") || "Title"}
								</Label>
								<Input
									value={lectureTitle}
									onChange={(e) => setLectureTitle(e.target.value)}
									placeholder={t("lecture_title") || "Lecture title"}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("description") || "Description"}
								</Label>
								<Input
									value={lectureDescription}
									onChange={(e) => setLectureDescription(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("lecture_content") || "Content (Markdown)"}
								</Label>
								<Textarea
									value={lectureContent}
									onChange={(e) => setLectureContent(e.target.value)}
									className="min-h-32 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<VideoUploadField
								value={lectureVideoId}
								onChange={setLectureVideoId}
							/>
						</div>
					) : kind === "text" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("heading") || "Heading"}
								</Label>
								<Input
									value={textTitle}
									onChange={(e) => setTextTitle(e.target.value)}
									placeholder={t("text_heading") || "Heading"}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("lecture_content") || "Content (Markdown)"}
								</Label>
								<Textarea
									value={textContent}
									onChange={(e) => setTextContent(e.target.value)}
									placeholder={t("enter_text") || "Enter text…"}
									className="min-h-40 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
					) : kind === "practice" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("title") || "Title"}
								</Label>
								<Input
									value={practiceTitle}
									onChange={(e) => setPracticeTitle(e.target.value)}
									placeholder={t("practice_title") || "Practice title"}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("description") || "Description"}
								</Label>
								<Input
									value={practiceDescription}
									onChange={(e) => setPracticeDescription(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<p className="text-slate-500 text-xs">
								{t("practice_create_hint") ||
									"Create the practice, then add tasks to it from the list."}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("exam_name") || "Exam name"}
								</Label>
								<Input
									value={examState.name ?? ""}
									onChange={(e) =>
										setExamState((s) => ({ ...s, name: e.target.value }))
									}
									placeholder={t("exam_name_placeholder") || "Enter exam name"}
									className="border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-slate-300">
									{t("exam_description") || "Description"}
								</Label>
								<Textarea
									value={(examState.description as string | undefined) ?? ""}
									onChange={(e) =>
										setExamState((s) => ({ ...s, description: e.target.value }))
									}
									className="min-h-24 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
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
										min={0}
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
							<div className="grid grid-cols-2 gap-4">
								<div className="flex flex-col gap-1">
									<Label className="text-slate-300">
										{t("starts_at") || "Starts at (optional)"}
									</Label>
									<Input
										type="datetime-local"
										value={startsAtLocal}
										onChange={(e) => setStartsAtLocal(e.target.value)}
										className="border-slate-700 bg-slate-800 text-white"
									/>
								</div>
								<div className="flex flex-col gap-1">
									<Label className="text-slate-300">
										{t("ends_at") || "Ends at (optional)"}
									</Label>
									<Input
										type="datetime-local"
										value={endsAtLocal}
										onChange={(e) => setEndsAtLocal(e.target.value)}
										className="border-slate-700 bg-slate-800 text-white"
									/>
								</div>
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
						onClick={submit}
						disabled={!canSubmit() || pending}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						{t("create") || "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
