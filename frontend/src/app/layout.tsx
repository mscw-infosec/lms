import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "@/styles/globals.css";
import { QueryProvider } from "@/components/query-provider";
import { UserProvider } from "@/store/user";
import { I18nProvider } from "@/components/i18n-provider";

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
				<I18nProvider>
					<QueryProvider>
						<UserProvider>{children}</UserProvider>
					</QueryProvider>
				</I18nProvider>
			</body>
		</html>
	);
}
