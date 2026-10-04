"use client";

import {
	type AttachmentDTO,
	type AttachmentOwner,
	attachmentsQueryKey,
	deleteAttachment,
	downloadAttachment,
	formatFileSize,
	listAttachments,
	uploadAttachment,
} from "@/api/attachments";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type UploadProgress = { key: string; name: string; percent: number };

/**
 * Additional materials of a lecture or task.
 *
 * Read-only by default: renders nothing until there is at least one file, so
 * learners don't see an empty section. With `editable`, staff can add and
 * remove files; uploads go straight to storage via presigned POST.
 */
export default function AttachmentList({
	owner,
	editable = false,
	className,
}: {
	owner: AttachmentOwner;
	editable?: boolean;
	className?: string;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploads, setUploads] = useState<UploadProgress[]>([]);
	const [downloadingId, setDownloadingId] = useState<string | null>(null);
	const queryKey = attachmentsQueryKey(owner);

	const attachmentsQuery = useQuery({
		queryKey,
		queryFn: () => listAttachments(owner),
		retry: false,
	});
	const attachments = attachmentsQuery.data ?? [];

	// `http` throws the raw `{"error": "..."}` body; show just the reason
	const errorMessage = (e: unknown, fallback: string) => {
		if (!(e instanceof Error) || !e.message) return fallback;
		try {
			const parsed: unknown = JSON.parse(e.message);
			if (
				parsed &&
				typeof parsed === "object" &&
				"error" in parsed &&
				typeof parsed.error === "string"
			) {
				return parsed.error;
			}
		} catch {}
		return e.message;
	};

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAttachment(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey }),
		onError: (e) =>
			toast({
				description: errorMessage(e, t("delete_failed") || "Failed to delete"),
			}),
	});

	const handleFiles = async (fileList: FileList | null) => {
		const files = Array.from(fileList ?? []);
		if (fileInputRef.current) fileInputRef.current.value = "";
		if (!files.length) return;

		const pending = files.map((file, i) => ({
			key: `${Date.now()}-${i}-${file.name}`,
			name: file.name,
			percent: 0,
		}));
		setUploads((prev) => [...prev, ...pending]);

		for (const [i, file] of files.entries()) {
			const { key } = pending[i] as UploadProgress;
			try {
				await uploadAttachment(owner, file, (percent) =>
					setUploads((prev) =>
						prev.map((u) => (u.key === key ? { ...u, percent } : u)),
					),
				);
				await queryClient.invalidateQueries({ queryKey });
			} catch (e) {
				toast({
					description: `${file.name}: ${errorMessage(
						e,
						t("upload_error") || "Upload failed",
					)}`,
				});
			} finally {
				setUploads((prev) => prev.filter((u) => u.key !== key));
			}
		}
	};

	const handleDownload = async (attachment: AttachmentDTO) => {
		setDownloadingId(attachment.id);
		try {
			await downloadAttachment(attachment.id);
		} catch (e) {
			toast({
				description: errorMessage(
					e,
					t("download_failed") || "Failed to download the file",
				),
			});
		} finally {
			setDownloadingId(null);
		}
	};

	if (!editable && attachments.length === 0) return null;

	return (
		<div className={cn("space-y-2", className)}>
			<Label className="flex items-center gap-1.5 text-slate-300">
				<Paperclip className="h-4 w-4" />
				{t("additional_materials") || "Additional materials"}
			</Label>

			{attachments.length > 0 ? (
				<ul className="divide-y divide-slate-800 rounded-md border border-slate-700 bg-slate-800/50">
					{attachments.map((attachment) => (
						<li
							key={attachment.id}
							className="flex items-center gap-2 px-3 py-2 text-sm"
						>
							<FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
							<button
								type="button"
								onClick={() => handleDownload(attachment)}
								className="min-w-0 flex-1 truncate text-left text-slate-200 hover:text-white hover:underline"
								title={attachment.file_name}
							>
								{attachment.file_name}
							</button>
							<span className="flex-shrink-0 text-slate-500 text-xs">
								{formatFileSize(attachment.size)}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => handleDownload(attachment)}
								disabled={downloadingId === attachment.id}
								className="h-7 w-7 flex-shrink-0 text-slate-300 hover:bg-slate-700 hover:text-white"
								aria-label={t("download") || "Download"}
							>
								{downloadingId === attachment.id ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Download className="h-4 w-4" />
								)}
							</Button>
							{editable ? (
								<ConfirmDialog
									title={t("delete_attachment_title") || "Delete file?"}
									description={attachment.file_name}
									confirmText={t("delete") || "Delete"}
									cancelText={t("cancel") || "Cancel"}
									onConfirm={() => deleteMutation.mutate(attachment.id)}
								>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										disabled={
											deleteMutation.isPending &&
											deleteMutation.variables === attachment.id
										}
										className="h-7 w-7 flex-shrink-0 text-red-400 hover:bg-transparent hover:text-red-300"
										aria-label={t("delete") || "Delete"}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</ConfirmDialog>
							) : null}
						</li>
					))}
				</ul>
			) : attachmentsQuery.isLoading ? (
				<div className="flex items-center gap-2 text-slate-400 text-xs">
					<Loader2 className="h-3 w-3 animate-spin" />
					{t("loading") || "Loading…"}
				</div>
			) : (
				<p className="text-slate-500 text-xs">
					{t("no_attachments") || "No files attached yet."}
				</p>
			)}

			{uploads.map((u) => (
				<div
					key={u.key}
					className="space-y-1 rounded-md border border-slate-700 bg-slate-800 p-2"
				>
					<div className="flex items-center gap-2 text-slate-200 text-xs">
						<Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
						<span className="truncate">{u.name}</span>
						<span className="ml-auto text-slate-400">{u.percent}%</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
						<div
							className="h-full rounded-full bg-red-600 transition-all"
							style={{ width: `${u.percent}%` }}
						/>
					</div>
				</div>
			))}

			{editable ? (
				<>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						className="hidden"
						onChange={(e) => handleFiles(e.target.files)}
					/>
					<Button
						type="button"
						variant="outline"
						onClick={() => fileInputRef.current?.click()}
						className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
					>
						<Paperclip className="mr-2 h-4 w-4" />
						{t("attach_files") || "Attach files"}
					</Button>
				</>
			) : null}
		</div>
	);
}
