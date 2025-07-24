import type React from "react";
('"use client');

import { cn } from "@/lib/utils";

interface ShellProps {
	children: React.ReactNode;
	className?: string;
}

export function Shell({ children, className }: ShellProps) {
	return (
		<div className={cn("container relative mx-auto space-y-8", className)}>
			{children}
		</div>
	);
}
