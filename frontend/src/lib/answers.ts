import type { PublicTaskDTO } from "@/api/exam";
import type { components } from "@/api/schema/schema";

export type TaskAnswerDTO = components["schemas"]["TaskAnswerDTO"];

export type UiAnswerPayload =
	| { name: "single_choice"; answer: number }
	| { name: "multiple_choice"; answers: number[] }
	| { name: "short_text"; answer: string }
	| { name: "long_text"; answer: string }
	| { name: "ordering"; answer: number[] }
	| { name: "file_upload"; file_id: string };

export function buildTaskAnswer(
	task: PublicTaskDTO,
	ui: UiAnswerPayload,
): TaskAnswerDTO {
	const { id } = task;
	switch (ui.name) {
		case "single_choice":
			return {
				task_id: id,
				answer: { name: "single_choice", answer: String(ui.answer) },
			};
		case "multiple_choice":
			return {
				task_id: id,
				answer: { name: "multiple_choice", answers: ui.answers.map(String) },
			};
		case "short_text":
			return {
				task_id: id,
				answer: { name: "short_text", answer: ui.answer },
			};
		case "long_text":
			return {
				task_id: id,
				answer: { name: "long_text", answer: ui.answer },
			};
		case "ordering":
			return {
				task_id: id,
				answer: { name: "ordering", answer: ui.answer.map(String) },
			};
		case "file_upload":
			return {
				task_id: id,
				answer: { name: "file_upload", file_id: ui.file_id },
			};
		default:
			return {
				task_id: id,
				answer: { name: "long_text", answer: JSON.stringify(ui) },
			};
	}
}
