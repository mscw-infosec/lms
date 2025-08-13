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
