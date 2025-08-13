"use client";

import DeleteCourseDialog from "@/components/course/delete-course-dialog";
import { Button } from "@/components/ui/button";
import { Edit, Loader2, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
	isEditing: boolean;
	canEdit: boolean;
	onEdit: () => void; // enter edit mode
	onSave: () => void;
	savePending?: boolean;
	canSave?: boolean;
	onCancel: () => void;
	onDelete: () => void;
	deletePending?: boolean;
	className?: string;
};

export default function CourseHeaderActions({
	isEditing,
	canEdit,
	onEdit,
	onSave,
	savePending,
	canSave,
	onCancel,
	onDelete,
	deletePending,
	className,
}: Props) {
	const { t } = useTranslation("common");

	if (!canEdit) return null;

	return (
		<div className={"flex items-center gap-2 " + (className ?? "")}>
			{isEditing ? (
				<>
					<Button
						onClick={onSave}
						size="icon"
						title={t("save") ?? "Save"}
						aria-label={t("save") ?? "Save"}
						disabled={!canSave || !!savePending}
						className="bg-red-600 text-white hover:bg-red-700"
					>
						{savePending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
					</Button>
					<DeleteCourseDialog pending={!!deletePending} onConfirm={onDelete} />
					<Button
						variant="ghost"
						size="icon"
						title={t("cancel") ?? "Cancel"}
						aria-label={t("cancel") ?? "Cancel"}
						onClick={onCancel}
						className="text-slate-300 hover:bg-slate-800"
					>
						<X className="h-4 w-4" />
					</Button>
				</>
			) : (
				<Button
					variant="secondary"
					size="sm"
					className="bg-transparent text-slate-300 transition-none hover:bg-transparent hover:text-white focus:bg-transparent active:bg-transparent"
					onClick={onEdit}
				>
					<Edit className="mr-2 h-4 w-4" />
					{t("edit")}
				</Button>
			)}
		</div>
	);
}
