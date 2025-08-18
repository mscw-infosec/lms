import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "infosec.moscow",
	description: "Занятия по информационной безопасности для школьников",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<script defer src="https://umami.justmarfix.ru/script.js" data-website-id="7551edd5-225b-4490-a0b0-6cfb1a6a13d8"></script>
				<style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
			</head>
			<body>{children}</body>
		</html>
	);
}
