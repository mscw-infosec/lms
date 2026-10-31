import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Unbounded({
	subsets: ["latin", "cyrillic"],
	weight: ["500", "700"],
	variable: "--nf-display",
});
const sans = Manrope({
	subsets: ["latin", "cyrillic"],
	variable: "--nf-body",
});
const mono = JetBrains_Mono({
	subsets: ["latin", "cyrillic"],
	weight: ["400", "600"],
	variable: "--nf-code",
});

export const viewport: Viewport = {
	themeColor: "#0b0a0c",
	colorScheme: "dark",
};

export const metadata: Metadata = {
	title: "infosec.moscow",
	description: "Занятия по информационной безопасности для школьников",
	keywords: [
		"ВсОШ",
		"всош",
		"сборная москвы по иб",
		"сборная москвы",
		"сборная москвы по информационной безопасности",
		"всош иб",
		"всош по иб",
		"сборная москвы иб",
		"цпм",
		"цпм иб",
		"цпм информационная безопасность",
		"инфобез",
		"цпм инфобез",
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="ru"
			className={`${display.variable} ${sans.variable} ${mono.variable}`}
		>
			<head>
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<script
					defer
					src="https://umami.justmarfix.ru/script.js"
					data-website-id="7551edd5-225b-4490-a0b0-6cfb1a6a13d8"
				/>
				{/* Yandex.Metrika counter */}
				<Script id="yandex-metrika" strategy="afterInteractive">
					{`
                    (function(m,e,t,r,i,k,a){
                    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                    m[i].l=1*new Date();
                    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
                })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=103961320', 'ym');

                    ym(103961320, 'init', {ssr:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
                `}
				</Script>
				<noscript>
					<div>
						<img
							src="https://mc.yandex.ru/watch/103961320"
							style={{ position: "absolute", left: "-9999px" }}
							alt=""
						/>
					</div>
				</noscript>
				{/* /Yandex.Metrika counter */}

				<meta property="og:title" content="infosec.moscow" />
				<meta
					property="og:description"
					content="Занятия по информационной безопасности для школьников"
				/>
				<meta property="og:type" content="website" />
				<meta property="og:url" content="https://infosec.moscow/" />
				<meta property="og:image" content="https://infosec.moscow/og.jpg" />
			</head>
			<body>{children}</body>
		</html>
	);
}
