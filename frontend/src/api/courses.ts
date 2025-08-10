<<<<<<< HEAD
import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type UpsertCourseResponseDTO =
	components["schemas"]["UpsertCourseResponseDTO"];
export type UpsertCourseRequestDTO =
	components["schemas"]["UpsertCourseRequestDTO"];
=======
import { http } from "./http";
import type { components } from "@/api/schema/schema";

export type UpsertCourseResponseDTO = components["schemas"]["UpsertCourseResponseDTO"];
export type UpsertCourseRequestDTO = components["schemas"]["UpsertCourseRequestDTO"];
>>>>>>> a548896 (DEV-10: frontend api connect)

export async function getAllCourses(): Promise<UpsertCourseResponseDTO[]> {
	return http<UpsertCourseResponseDTO[]>("/api/courses", { withAuth: true });
}

<<<<<<< HEAD
export async function createCourse(
	data: UpsertCourseRequestDTO,
): Promise<UpsertCourseResponseDTO> {
=======
export async function createCourse(data: UpsertCourseRequestDTO): Promise<UpsertCourseResponseDTO> {
>>>>>>> a548896 (DEV-10: frontend api connect)
	return http<UpsertCourseResponseDTO>("/api/courses/new", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

<<<<<<< HEAD
export async function getCourseById(
	courseId: number,
): Promise<UpsertCourseResponseDTO> {
	return http<UpsertCourseResponseDTO>(`/api/courses/${courseId}`, {
		withAuth: true,
	});
}

export async function editCourse(
	courseId: number,
	data: UpsertCourseRequestDTO,
): Promise<UpsertCourseResponseDTO> {
=======
export async function getCourseById(courseId: number): Promise<UpsertCourseResponseDTO> {
	return http<UpsertCourseResponseDTO>(`/api/courses/${courseId}`, { withAuth: true });
}

export async function editCourse(courseId: number, data: UpsertCourseRequestDTO): Promise<UpsertCourseResponseDTO> {
>>>>>>> a548896 (DEV-10: frontend api connect)
	return http<UpsertCourseResponseDTO>(`/api/courses/${courseId}`, {
		method: "PUT",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteCourse(courseId: number): Promise<void> {
<<<<<<< HEAD
	await http<void>(`/api/courses/${courseId}`, {
		method: "DELETE",
		withAuth: true,
	});
}

export type TopicResponseDTO = components["schemas"]["TopicResponseDTO"];

export async function getCourseTopics(
	courseId: number,
): Promise<TopicResponseDTO[]> {
	return http<TopicResponseDTO[]>(`/api/courses/${courseId}/topics`, {
		withAuth: true,
	});
}
=======
	await http<void>(`/api/courses/${courseId}`, { method: "DELETE", withAuth: true });
}

export type TopicResponseDTO = components["schemas"]["TopicResponseDTO"]

export async function getCourseTopics(courseId: number): Promise<TopicResponseDTO[]> {
	return http<TopicResponseDTO[]>(`/api/courses/${courseId}/topics`, { withAuth: true });
} 
>>>>>>> a548896 (DEV-10: frontend api connect)
