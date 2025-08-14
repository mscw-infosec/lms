"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type React from "react";

export type ConfirmDialogProps = {
	title: React.ReactNode;
	description?: React.ReactNode;
	confirmText?: React.ReactNode;
	cancelText?: React.ReactNode;
	onConfirm: () => void;
	children: React.ReactNode; // trigger
	contentClassName?: string;
	cancelClassName?: string;
	actionClassName?: string;
};

export function ConfirmDialog({
	title,
	description,
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	children,
	contentClassName,
	cancelClassName,
	actionClassName,
}: ConfirmDialogProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent
				className={
					contentClassName ?? "border-slate-800 bg-slate-900 text-slate-300"
				}
			>
				<DialogHeader>
					<DialogTitle className="text-white">{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							type="button"
							className={
								cancelClassName ??
								"border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
							}
						>
							{cancelText}
						</Button>
					</DialogClose>
					<DialogClose asChild>
						<Button
							className={
								actionClassName ?? "bg-red-600 text-white hover:bg-red-700"
							}
							onClick={onConfirm}
						>
							{confirmText}
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default ConfirmDialog;
