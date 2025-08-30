"use client";

import type { TaskConfig, TaskDTO, UpsertTaskRequestDTO } from "@/api/tasks";
import { updateTask } from "@/api/tasks";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface EditTaskDialogProps {
	task: TaskDTO;
	children: ReactNode;
	onUpdated?: (task: TaskDTO) => void;
}

export default function EditTaskDialog({
	task,
	children,
	onUpdated,
}: EditTaskDialogProps) {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);

	const taskType = task.task_type;
	const [submitting, setSubmitting] = useState(false);

	const [description, setDescription] = useState<string>("");

	const [scOptions, setScOptions] = useState<string>("");

	const [scCorrectInput, setScCorrectInput] = useState<string>("0");
	const [scShuffle, setScShuffle] = useState<"true" | "false">("true");

	const [mcOptions, setMcOptions] = useState<string>("");
	const [mcCorrect, setMcCorrect] = useState<string>("");
	const [mcPartial, setMcPartial] = useState<"true" | "false">("true");
	const [mcShuffle, setMcShuffle] = useState<"true" | "false">("true");

	const [stAnswers, setStAnswers] = useState<string>("");
	const [stAuto, setStAuto] = useState<"true" | "false">("true");
	const [stMaxChars, setStMaxChars] = useState<number>(256);

	const [ltMaxChars, setLtMaxChars] = useState<number>(2000);

	const [ordItems, setOrdItems] = useState<string>("");
	const [ordOrder, setOrdOrder] = useState<string>("");

	const [fuMaxSize, setFuMaxSize] = useState<number>(10);

	const [ctfdTaskId, setCtfdTaskId] = useState<number>(0);

	const scOptionsCount = scOptions
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean).length;
	const parsedScCorrect =
		scCorrectInput.trim() === "" ? Number.NaN : Number(scCorrectInput);
	const scIndexInvalid =
		taskType === "SingleChoice" &&
		scOptionsCount > 0 &&
		Number.isFinite(parsedScCorrect) &&
		parsedScCorrect >= scOptionsCount;

	useEffect(() => {
		if (!open) return;

		setDescription(
			typeof task.description === "string" ? task.description : "",
		);

		type LooseCfg = {
			options?: unknown;
			correct?: unknown;
			shuffle?: unknown;
			partial_score?: unknown;
			answers?: unknown;
			auto_grade?: unknown;
			max_chars_count?: unknown;
			items?: unknown;
			max_size?: unknown;
			task_id?: unknown;
		};
		const cfg = task.configuration as unknown as LooseCfg;
		switch (task.task_type) {
			case "SingleChoice":
				setScOptions(
					(Array.isArray(cfg.options) ? (cfg.options as unknown[]) : [])
						.map((s) => String(s))
						.join("\n"),
				);
				setScCorrectInput(
					String(typeof cfg.correct === "number" ? (cfg.correct as number) : 0),
				);
				setScShuffle(
					(cfg.shuffle === true ? "true" : "false") as "true" | "false",
				);
				break;
			case "MultipleChoice":
				setMcOptions(
					(Array.isArray(cfg.options) ? (cfg.options as unknown[]) : [])
						.map((s) => String(s))
						.join("\n"),
				);
				setMcCorrect(
					Array.isArray(cfg.correct)
						? (cfg.correct as unknown[]).map((x) => String(x)).join(",")
						: "",
				);
				setMcPartial(
					(cfg.partial_score === true ? "true" : "false") as "true" | "false",
				);
				setMcShuffle(
					(cfg.shuffle === true ? "true" : "false") as "true" | "false",
				);
				break;
			case "ShortText":
				setStAnswers(
					(Array.isArray(cfg.answers) ? (cfg.answers as unknown[]) : [])
						.map((s) => String(s))
						.join("\n"),
				);
				setStAuto(
					(cfg.auto_grade === true ? "true" : "false") as "true" | "false",
				);
				setStMaxChars(
					typeof cfg.max_chars_count === "number"
						? (cfg.max_chars_count as number)
						: 256,
				);
				break;
			case "LongText":
				setLtMaxChars(
					typeof cfg.max_chars_count === "number"
						? (cfg.max_chars_count as number)
						: 2000,
				);
				break;
			case "Ordering":
				setOrdItems(
					(Array.isArray(cfg.items) ? (cfg.items as unknown[]) : [])
						.map((s) => String(s))
						.join("\n"),
				);
				setOrdOrder(
					Array.isArray(cfg.answers) &&
						Array.isArray((cfg.answers as unknown[])[0])
						? ((cfg.answers as unknown[])[0] as unknown[])
								.map((x) => String(x))
								.join(",")
						: "",
				);
				break;
			case "FileUpload":
				setFuMaxSize(
					typeof cfg.max_size === "number" ? (cfg.max_size as number) : 10,
				);
				break;
			case "ctfd":
				setCtfdTaskId(
					typeof cfg.task_id === "number" ? (cfg.task_id as number) : 0,
				);
				break;
		}
	}, [open, task]);

	async function handleSave() {
		setSubmitting(true);
		try {
			let config: TaskConfig;
			switch (taskType) {
				case "SingleChoice": {
					const options = scOptions
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					if (options.length < 2) {
						// eslint-disable-next-line no-alert
						alert(
							(t("please_provide_at_least_two_options") as string) ||
								"Please provide at least two options",
						);
						return;
					}
					const correct = Number(scCorrectInput);
					if (
						!Number.isFinite(correct) ||
						correct < 0 ||
						correct >= options.length
					) {
						// eslint-disable-next-line no-alert
						alert(
							(t("correct_index_out_of_range") as string) ||
								"Correct index is out of range",
						);
						return;
					}
					config = {
						name: "single_choice",
						options,
						correct,
						shuffle: scShuffle === "true",
					};
					break;
				}
				case "MultipleChoice": {
					const options = mcOptions
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					if (options.length < 2) {
						// eslint-disable-next-line no-alert
						alert(
							(t("please_provide_at_least_two_options") as string) ||
								"Please provide at least two options",
						);
						return;
					}
					const correct = mcCorrect
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0)
						.map((s) => Number(s))
						.filter((n) => Number.isFinite(n));
					if (
						correct.length === 0 ||
						correct.some((idx) => idx < 0 || idx >= options.length)
					) {
						// eslint-disable-next-line no-alert
						alert(
							(t("correct_indices_invalid") as string) ||
								"Correct indices are empty or out of range",
						);
						return;
					}
					config = {
						name: "multiple_choice",
						options,
						correct,
						partial_score: mcPartial === "true",
						shuffle: mcShuffle === "true",
					};
					break;
				}
				case "ShortText": {
					const answers = stAnswers
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					config = {
						name: "short_text",
						answers,
						auto_grade: stAuto === "true",
						max_chars_count: stMaxChars,
					};
					break;
				}
				case "LongText": {
					config = { name: "long_text", max_chars_count: ltMaxChars };
					break;
				}
				case "Ordering": {
					const items = ordItems
						.split("\n")
						.map((s) => s.trim())
						.filter(Boolean);
					const order = ordOrder
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0)
						.map((s) => Number(s))
						.filter((n) => Number.isFinite(n));
					config = { name: "ordering", items, answers: [order] };
					break;
				}
				case "FileUpload": {
					config = { name: "file_upload", max_size: fuMaxSize };
					break;
				}
				case "ctfd": {
					config = { name: "ctfd", task_id: ctfdTaskId };
					break;
				}
			}

			const payloadDescription = taskType === "ctfd" ? "" : description;
			const payload: UpsertTaskRequestDTO = {
				title: task.title,
				description: payloadDescription,
				points: task.points,
				task_type: task.task_type,
				configuration: config,
			};

			await updateTask(task.id, payload);
			onUpdated?.({ ...task, description: payloadDescription, configuration: config } as TaskDTO);
			setOpen(false);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="border-slate-800 bg-slate-900 text-slate-200">
				<DialogHeader>
					<DialogTitle className="text-white">
						{t("edit") || "Edit"} {t("task") || "Task"}
					</DialogTitle>
					<DialogDescription className="text-slate-400">
						{t("type") || "Type"}: {task.task_type}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2">
					<div className="space-y-2">
						<Label className="text-slate-300">
							{t("description") || "Description"}
						</Label>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="mt-1 border-slate-700 bg-slate-800 text-white"
							rows={3}
							disabled={taskType === "ctfd"}
						/>
					</div>
					{taskType === "SingleChoice" && (
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("options") || "Options"}
							</Label>
							<Textarea
								value={scOptions}
								onChange={(e) => setScOptions(e.target.value)}
								className="mt-1 border-slate-700 bg-slate-800 text-white"
								rows={5}
							/>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div>
									<Label className="text-slate-300">
										{t("correct_index") || "Correct index"}
									</Label>
									<Input
										type="number"
										min={0}
										value={scCorrectInput}
										onChange={(e) => setScCorrectInput(e.target.value)}
										onWheel={(e) =>
											(e.currentTarget as HTMLInputElement).blur()
										}
										className="mt-1 border-slate-700 bg-slate-800 text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
									<div className="mt-1 text-slate-500 text-xs">
										{t("zero_based_do_not_add_one")}
									</div>
									{scIndexInvalid && (
										<div className="mt-1 text-red-500 text-xs">
											{t("index_must_be_less_than_options_count", {
												count: scOptionsCount,
											})}
										</div>
									)}
								</div>
								<div>
									<Label className="text-slate-300">
										{t("shuffle") || "Shuffle"}
									</Label>
									<Select
										value={scShuffle}
										onValueChange={(v: "true" | "false") => setScShuffle(v)}
									>
										<SelectTrigger className="mt-1 border-slate-700 bg-slate-800 text-white">
											<SelectValue placeholder={t("select") || "Select"} />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-900 text-white">
											<SelectItem value="true">{t("yes") || "Yes"}</SelectItem>
											<SelectItem value="false">{t("no") || "No"}</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					)}

					{taskType === "MultipleChoice" && (
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("options") || "Options"}
							</Label>
							<Textarea
								value={mcOptions}
								onChange={(e) => setMcOptions(e.target.value)}
								className="mt-1 border-slate-700 bg-slate-800 text-white"
								rows={5}
							/>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div>
									<Label className="text-slate-300">
										{t("correct_indices") || "Correct indices"}
									</Label>
									<Input
										value={mcCorrect}
										onChange={(e) => setMcCorrect(e.target.value)}
										placeholder="0,2,3"
										className="mt-1 border-slate-700 bg-slate-800 text-white"
									/>
									<div className="mt-1 text-slate-500 text-xs">
										{t("zero_based_comma_separated")}
									</div>
								</div>
								<div>
									<Label className="text-slate-300">
										{t("partial_score") || "Partial score"}
									</Label>
									<Select
										value={mcPartial}
										onValueChange={(v: "true" | "false") => setMcPartial(v)}
									>
										<SelectTrigger className="mt-1 border-slate-700 bg-slate-800 text-white">
											<SelectValue placeholder={t("select") || "Select"} />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-900 text-white">
											<SelectItem value="true">{t("yes") || "Yes"}</SelectItem>
											<SelectItem value="false">{t("no") || "No"}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-slate-300">
										{t("shuffle") || "Shuffle"}
									</Label>
									<Select
										value={mcShuffle}
										onValueChange={(v: "true" | "false") => setMcShuffle(v)}
									>
										<SelectTrigger className="mt-1 border-slate-700 bg-slate-800 text-white">
											<SelectValue placeholder={t("select") || "Select"} />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-900 text-white">
											<SelectItem value="true">{t("yes") || "Yes"}</SelectItem>
											<SelectItem value="false">{t("no") || "No"}</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					)}

					{taskType === "ShortText" && (
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("answers") || "Answers"}
							</Label>
							<Textarea
								value={stAnswers}
								onChange={(e) => setStAnswers(e.target.value)}
								className="mt-1 border-slate-700 bg-slate-800 text-white"
								rows={4}
							/>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								<div>
									<Label className="text-slate-300">
										{t("auto_grade") || "Auto grade"}
									</Label>
									<Select
										value={stAuto}
										onValueChange={(v: "true" | "false") => setStAuto(v)}
									>
										<SelectTrigger className="mt-1 border-slate-700 bg-slate-800 text-white">
											<SelectValue placeholder={t("select") || "Select"} />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-900 text-white">
											<SelectItem value="true">{t("yes") || "Yes"}</SelectItem>
											<SelectItem value="false">{t("no") || "No"}</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-slate-300">
										{t("max_chars_count") || "Max chars"}
									</Label>
									<Input
										type="number"
										min={1}
										value={stMaxChars}
										onChange={(e) => setStMaxChars(Number(e.target.value))}
										className="mt-1 border-slate-700 bg-slate-800 text-white"
									/>
								</div>
							</div>
						</div>
					)}

					{taskType === "LongText" && (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div>
								<Label className="text-slate-300">
									{t("max_chars_count") || "Max chars"}
								</Label>
								<Input
									type="number"
									min={1}
									value={ltMaxChars}
									onChange={(e) => setLtMaxChars(Number(e.target.value))}
									className="mt-1 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
					)}

					{taskType === "Ordering" && (
						<div className="space-y-2">
							<Label className="text-slate-300">{t("items") || "Items"}</Label>
							<Textarea
								value={ordItems}
								onChange={(e) => setOrdItems(e.target.value)}
								className="mt-1 border-slate-700 bg-slate-800 text-white"
								rows={4}
							/>
							<div>
								<Label className="text-slate-300">
									{t("correct_order") || "Correct order"}
								</Label>
								<Input
									value={ordOrder}
									onChange={(e) => setOrdOrder(e.target.value)}
									placeholder="0,1,2,3"
									className="mt-1 border-slate-700 bg-slate-800 text-white"
								/>
								<div className="mt-1 text-slate-500 text-xs">
									{t("zero_based_comma_separated")}
								</div>
							</div>
						</div>
					)}

					{taskType === "FileUpload" && (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div>
								<Label className="text-slate-300">
									{t("max_size") || "Max size (MB)"}
								</Label>
								<Input
									type="number"
									min={1}
									value={fuMaxSize}
									onChange={(e) => setFuMaxSize(Number(e.target.value))}
									className="mt-1 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
					)}

					{taskType === "ctfd" && (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div>
								<Label className="text-slate-300">
									{t("external_task_id") || "External task id"}
								</Label>
								<Input
									type="number"
									min={0}
									value={ctfdTaskId}
									onChange={(e) => setCtfdTaskId(Number(e.target.value))}
									className="mt-1 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => setOpen(false)}
						className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					>
						{t("cancel") || "Cancel"}
					</Button>
					<Button
						onClick={handleSave}
						disabled={
							submitting ||
							(taskType === "SingleChoice" &&
								(scCorrectInput.trim() === "" ||
									!Number.isFinite(parsedScCorrect) ||
									scIndexInvalid))
						}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						{submitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							t("save") || "Save"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
