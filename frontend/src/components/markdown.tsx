import type React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Pluggable, PluggableList } from "unified";
let rehypeHighlight: Pluggable | null = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const mod = require("rehype-highlight");
	rehypeHighlight = (mod && (mod.default ?? mod)) || null;
} catch (_) {
	rehypeHighlight = null;
}

type MarkdownProps = {
	content: string;
	className?: string;
};

// Server-compatible Markdown renderer with LaTeX support via KaTeX
export default function Markdown({ content, className }: MarkdownProps) {
	if (!content) return null;
	const rehypePluginsArr: PluggableList = [rehypeKatex as Pluggable];
	if (rehypeHighlight) {
		rehypePluginsArr.push(rehypeHighlight);
	}
	return (
		<div
			className={className ?? "markdown-body max-w-none text-slate-300 text-sm"}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={rehypePluginsArr}
				components={{
					h1: ({ node, ...props }) => (
						<h1
							className="mt-3 mb-2 font-semibold text-white text-xl md:text-xl"
							{...props}
						/>
					),
					h2: ({ node, ...props }) => (
						<h2
							className="mt-3 mb-2 font-semibold text-lg text-white md:text-lg"
							{...props}
						/>
					),
					h3: ({ node, ...props }) => (
						<h3
							className="mt-2 mb-2 font-semibold text-md text-white md:text-md"
							{...props}
						/>
					),
					h4: ({ node, ...props }) => (
						<h4
							className="mt-2 mb-2 font-semibold text-base text-slate-100"
							{...props}
						/>
					),
					h5: ({ node, ...props }) => (
						<h5
							className="mt-2 mb-2 font-semibold text-base text-slate-200"
							{...props}
						/>
					),
					h6: ({ node, ...props }) => (
						<h6
							className="mt-2 mb-2 text-slate-300 text-sm uppercase tracking-wide"
							{...props}
						/>
					),
					ul: ({ node, ...props }) => (
						<ul className="my-3 list-disc space-y-1 pl-6" {...props} />
					),
					ol: ({ node, ...props }) => (
						<ol className="my-3 list-decimal space-y-1 pl-6" {...props} />
					),
					li: ({ node, ...props }) => (
						<li className="marker:text-slate-400" {...props} />
					),
					pre: ({ node, ...props }) => (
						<pre
							className="my-4 overflow-x-auto rounded-md border border-slate-800 bg-slate-900 p-4 text-slate-200"
							{...props}
						/>
					),
					code: ({
						inline,
						className,
						children,
						...rest
					}: {
						inline?: boolean;
						className?: string;
						children?: React.ReactNode;
					} & React.HTMLAttributes<HTMLElement>) => {
						const base =
							"rounded bg-slate-800/70 px-1.5 py-0.5 font-mono text-xs text-slate-200";
						if (inline) {
							return (
								<code className={`${base}`} {...rest}>
									{children}
								</code>
							);
						}
						return (
							<code className={`${className ?? ""}`} {...rest}>
								{children}
							</code>
						);
					},
				}}
				skipHtml
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
