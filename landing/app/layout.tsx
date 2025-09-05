import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "infosec.moscow",
	description: "Занятия по информационной безопасности для школьников",
    keywords: ["ВсОШ", "всош", "сборная москвы по иб", "сборная москвы", "сборная москвы по информационной безопасности", "всош иб", "всош по иб", "сборная москвы иб"]
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
        <head>
            <link rel="icon" href="https://infosec.moscow/favicon.ico" type="image/x-icon"/>
            <script defer src="https://umami.justmarfix.ru/script.js"
                    data-website-id="7551edd5-225b-4490-a0b0-6cfb1a6a13d8"></script>
            <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
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
                <div><img src="https://mc.yandex.ru/watch/103961320" style={{position: "absolute", left: "-9999px"}}
                          alt=""/></div>
            </noscript>
            {/* /Yandex.Metrika counter */}

            <meta property="og:title" content="infosec.moscow"/>
            <meta property="og:description" content="Занятия по информационной безопасности для школьников"/>
            <meta property="og:type" content="website"/>
            <meta property="og:url" content="https://infosec.moscow/"/>
            <meta property="og:image" content="https://infosec.moscow/favicon.ico"/>
        </head>
        <body>{children}</body>
        </html>
    );
}
