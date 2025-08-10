import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					type === "file" && "bg-slate-900 text-slate-200 [color-scheme:dark] items-center border-0",
					"file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:leading-none file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-700 file:transition-colors file:cursor-pointer focus:file:outline-none",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
