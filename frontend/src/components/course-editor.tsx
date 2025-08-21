"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
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
import {
	BookOpen,
	Edit,
	HelpCircle,
	Play,
	Plus,
	Save,
	Trash2,
} from "lucide-react";
import { useState } from "react";

interface Lecture {
	id: number;
	title: string;
	type: "lecture" | "task";
	completed: boolean;
	content?: string;
}

interface CourseModule {
	id: number;
	title: string;
	lectures: Lecture[];
}

interface CourseEditorProps {
	courseStructure: CourseModule[];
	onUpdateStructure: (newStructure: CourseModule[]) => void;
}

export function CourseEditor({
	courseStructure,
	onUpdateStructure,
}: CourseEditorProps) {
	const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
	const [editingLecture, setEditingLecture] = useState<
		(Lecture & { moduleId: number }) | null
	>(null);
	const [newModuleTitle, setNewModuleTitle] = useState("");
	const [newLectureTitle, setNewLectureTitle] = useState("");
	const [newLectureType, setNewLectureType] = useState<"lecture" | "task">(
		"lecture",
	);
	const [editModuleTitle, setEditModuleTitle] = useState("");
	const [editLectureTitle, setEditLectureTitle] = useState("");
	const [editLectureContent, setEditLectureContent] = useState("");

	const addModule = () => {
		if (!newModuleTitle.trim()) return;

		const newModule: CourseModule = {
			id: Math.max(...courseStructure.map((m) => m.id), 0) + 1,
			title: newModuleTitle,
			lectures: [],
		};

		onUpdateStructure([...courseStructure, newModule]);
		setNewModuleTitle("");
	};

	const addLecture = (moduleId: number) => {
		if (!newLectureTitle.trim()) return;

		const newStructure = courseStructure.map((module) => {
			if (module.id === moduleId) {
				const maxLectureId = Math.max(
					...courseStructure.flatMap((m) => m.lectures.map((l) => l.id)),
					0,
				);

				const newLecture: Lecture = {
					id: maxLectureId + 1,
					title: newLectureTitle,
					type: newLectureType,
					completed: false,
				};

				return {
					...module,
					lectures: [...module.lectures, newLecture],
				};
			}
			return module;
		});

		onUpdateStructure(newStructure);
		setNewLectureTitle("");
		setNewLectureType("lecture");
	};

	const updateModule = (moduleId: number, newTitle: string) => {
		const newStructure = courseStructure.map((module) => {
			if (module.id === moduleId) {
				return { ...module, title: newTitle };
			}
			return module;
		});
		onUpdateStructure(newStructure);
		setEditingModule(null);
		setEditModuleTitle("");
	};

	const updateLecture = (
		moduleId: number,
		lectureId: number,
		newTitle: string,
		newContent?: string,
	) => {
		const newStructure = courseStructure.map((module) => {
			if (module.id === moduleId) {
				return {
					...module,
					lectures: module.lectures.map((lecture: Lecture) => {
						if (lecture.id === lectureId) {
							return { ...lecture, title: newTitle, content: newContent };
						}
						return lecture;
					}),
				};
			}
			return module;
		});
		onUpdateStructure(newStructure);
		setEditingLecture(null);
		setEditLectureTitle("");
		setEditLectureContent("");
	};

	const deleteModule = (moduleId: number) => {
		onUpdateStructure(courseStructure.filter((m) => m.id !== moduleId));
	};

	const deleteLecture = (moduleId: number, lectureId: number) => {
		const newStructure = courseStructure.map((module) => {
			if (module.id === moduleId) {
				return {
					...module,
					lectures: module.lectures.filter((l: Lecture) => l.id !== lectureId),
				};
			}
			return module;
		});

		onUpdateStructure(newStructure);
	};

	const openEditModule = (module: CourseModule) => {
		setEditingModule(module);
		setEditModuleTitle(module.title);
	};

	const openEditLecture = (moduleId: number, lecture: Lecture) => {
		setEditingLecture({ ...lecture, moduleId });
		setEditLectureTitle(lecture.title);
		setEditLectureContent(lecture.content || "");
	};

	return (
		<div className="space-y-4">
			{/* Add New Module */}
			<Card className="border-slate-700 bg-slate-800">
				<CardHeader className="pb-3">
					<CardTitle className="text-sm text-white">Add New Module</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex gap-2">
						<Input
							value={newModuleTitle}
							onChange={(e) => setNewModuleTitle(e.target.value)}
							placeholder="Module title..."
							className="border-slate-600 bg-slate-700 text-sm text-white"
						/>
						<Button
							onClick={addModule}
							size="sm"
							className="bg-red-600 text-white hover:bg-red-700"
						>
							<Plus className="h-3 w-3" />
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Course Structure */}
			<div className="space-y-3">
				{courseStructure.map((module) => (
					<Card key={module.id} className="border-slate-700 bg-slate-800">
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center">
									<BookOpen className="mr-2 h-4 w-4 text-slate-400" />
									<CardTitle className="text-sm text-white">
										{module.title}
									</CardTitle>
								</div>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => openEditModule(module)}
										className="h-6 w-6 p-1 text-slate-400 hover:text-white"
									>
										<Edit className="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => deleteModule(module.id)}
										className="h-6 w-6 p-1 text-red-400 hover:text-red-300"
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							{/* Add New Lecture */}
							<div className="mb-3 flex gap-2">
								<Input
									value={newLectureTitle}
									onChange={(e) => setNewLectureTitle(e.target.value)}
									placeholder="New lecture/task..."
									className="border-slate-600 bg-slate-700 text-sm text-white"
								/>
								<Select
									value={newLectureType}
									onValueChange={(value: "lecture" | "task") =>
										setNewLectureType(value)
									}
								>
									<SelectTrigger className="w-20 border-slate-600 bg-slate-700 text-sm text-white">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-slate-700 bg-slate-800">
										<SelectItem value="lecture" className="text-sm text-white">
											Lecture
										</SelectItem>
										<SelectItem value="task" className="text-sm text-white">
											Task
										</SelectItem>
									</SelectContent>
								</Select>
								<Button
									onClick={() => addLecture(module.id)}
									size="sm"
									className="bg-red-600 text-white hover:bg-red-700"
								>
									<Plus className="h-3 w-3" />
								</Button>
							</div>

							{/* Lectures List */}
							<div className="space-y-1">
								{module.lectures.map((lecture) => (
									<div
										key={lecture.id}
										className="flex items-center justify-between rounded bg-slate-700 p-2 text-sm"
									>
										<div className="flex items-center">
											{lecture.type === "lecture" ? (
												<Play className="mr-2 h-3 w-3 text-blue-400" />
											) : (
												<HelpCircle className="mr-2 h-3 w-3 text-orange-400" />
											)}
											<span className="text-slate-300">{lecture.title}</span>
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => openEditLecture(module.id, lecture)}
												className="h-5 w-5 p-1 text-slate-400 hover:text-white"
											>
												<Edit className="h-2.5 w-2.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => deleteLecture(module.id, lecture.id)}
												className="h-5 w-5 p-1 text-red-400 hover:text-red-300"
											>
												<Trash2 className="h-2.5 w-2.5" />
											</Button>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Edit Module Dialog */}
			<Dialog
				open={!!editingModule}
				onOpenChange={() => setEditingModule(null)}
			>
				<DialogContent className="border-slate-800 bg-slate-900">
					<DialogHeader>
						<DialogTitle className="text-white">Edit Module</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label className="text-slate-300">Module Title</Label>
							<Input
								value={editModuleTitle}
								onChange={(e) => setEditModuleTitle(e.target.value)}
								className="border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<div className="flex gap-2">
							<Button
								onClick={() => {
									if (!editingModule) return;
									updateModule(editingModule.id, editModuleTitle);
								}}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								<Save className="mr-2 h-4 w-4" />
								Save Changes
							</Button>
							<Button
								variant="outline"
								onClick={() => setEditingModule(null)}
								className="border-slate-700 text-slate-300"
							>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Lecture Dialog */}
			<Dialog
				open={!!editingLecture}
				onOpenChange={() => setEditingLecture(null)}
			>
				<DialogContent className="border-slate-800 bg-slate-900">
					<DialogHeader>
						<DialogTitle className="text-white">
							Edit {editingLecture?.type === "lecture" ? "Lecture" : "Task"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label className="text-slate-300">Title</Label>
							<Input
								value={editLectureTitle}
								onChange={(e) => setEditLectureTitle(e.target.value)}
								className="border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						{editingLecture?.type === "lecture" && (
							<div>
								<Label className="text-slate-300">Content</Label>
								<Textarea
									value={editLectureContent}
									onChange={(e) => setEditLectureContent(e.target.value)}
									placeholder="Lecture content..."
									className="h-32 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						)}
						{editingLecture?.type === "task" && (
							<div>
								<Label className="text-slate-300">
									Questions (JSON format)
								</Label>
								<Textarea
									value={editLectureContent}
									onChange={(e) => setEditLectureContent(e.target.value)}
									placeholder="Add questions in JSON format..."
									className="h-32 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						)}
						<div className="flex gap-2">
							<Button
								onClick={() => {
									if (!editingLecture) return;
									updateLecture(
										editingLecture.moduleId,
										editingLecture.id,
										editLectureTitle,
										editLectureContent,
									);
								}}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								<Save className="mr-2 h-4 w-4" />
								Save Changes
							</Button>
							<Button
								variant="outline"
								onClick={() => setEditingLecture(null)}
								className="border-slate-700 text-slate-300"
							>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
