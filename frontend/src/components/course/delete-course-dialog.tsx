"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

export type DeleteCourseDialogProps = {
	onConfirm: () => void;
	pending?: boolean;
	className?: string;
	triggerSize?: "default" | "sm" | "lg" | "icon";
	iconOnly?: boolean;
};

export function DeleteCourseDialog({
	onConfirm,
	pending = false,
	className,
	triggerSize = "icon",
	iconOnly = true,
}: DeleteCourseDialogProps) {
	const { t } = useTranslation("common");

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="destructive"
					size={triggerSize}
					className={className}
					disabled={pending}
				>
					{pending ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : iconOnly ? (
						<Trash className="h-4 w-4" />
					) : (
						<>
							<Trash className="mr-2 h-4 w-4" />
							{t("delete")}
						</>
					)}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent className="border-slate-800 bg-slate-900 text-slate-300">
				<AlertDialogHeader>
					<AlertDialogTitle className="text-white">
						{t("delete_course")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("delete_course_confirm")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
						{t("cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						className="bg-red-600 text-white hover:bg-red-700"
						onClick={onConfirm}
					>
						{t("delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export default DeleteCourseDialog;
