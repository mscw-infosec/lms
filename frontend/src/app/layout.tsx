import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "@/styles/globals.css";
import { QueryProvider } from "@/components/query-provider";
import { UserProvider } from "@/store/user";

export const metadata: Metadata = {
	title: "LMS",
	description: "Learning Management System",
	generator: "",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
			</head>
			<body>
				<QueryProvider>
					<UserProvider>{children}</UserProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
