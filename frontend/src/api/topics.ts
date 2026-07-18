import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type TopicResponseDTO = components["schemas"]["TopicResponseDTO"];
export type UpsertTopicRequestDTO =
	components["schemas"]["UpsertTopicRequestDTO"];

export async function createTopic(data: UpsertTopicRequestDTO): Promise<void> {
	// POST /api/topics/new returns 201 with empty body
	await http<void>("/api/topics/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function getTopicById(id: number): Promise<TopicResponseDTO> {
	return http<TopicResponseDTO>(`/api/topics/${id}`, { withAuth: true });
}

export async function updateTopic(
	id: number,
	data: UpsertTopicRequestDTO,
): Promise<void> {
	await http<void>(`/api/topics/${id}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteTopic(id: number): Promise<void> {
	await http<void>(`/api/topics/${id}`, { method: "DELETE", withAuth: true });
}

export type TopicContentItemDTO = components["schemas"]["TopicContentItemDTO"];
export type TopicItemKind = "lecture" | "practice" | "exam" | "text";

export async function getTopicContent(
	topicId: number,
): Promise<TopicContentItemDTO[]> {
	return http<TopicContentItemDTO[]>(`/api/topics/${topicId}/content`, {
		withAuth: true,
	});
}

export async function reorderTopicContent(
	topicId: number,
	items: { kind: string; id: string }[],
): Promise<void> {
	await http<void>(`/api/topics/${topicId}/content/order`, {
		method: "PUT",
		body: JSON.stringify({ items }),
		withAuth: true,
	});
}

export async function createTopicText(
	topicId: number,
	content: string,
): Promise<{ id: number }> {
	return http<{ id: number }>(`/api/topics/${topicId}/text`, {
		method: "POST",
		body: JSON.stringify({ content }),
		withAuth: true,
	});
}

export async function updateTopicText(
	topicId: number,
	textId: number,
	content: string,
): Promise<void> {
	await http<void>(`/api/topics/${topicId}/text/${textId}`, {
		method: "PUT",
		body: JSON.stringify({ content }),
		withAuth: true,
	});
}

export async function deleteTopicText(
	topicId: number,
	textId: number,
): Promise<void> {
	await http<void>(`/api/topics/${topicId}/text/${textId}`, {
		method: "DELETE",
		withAuth: true,
	});
}
