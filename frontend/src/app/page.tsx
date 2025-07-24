"use client";

import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Clock, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const courses = [
	{
		id: 1,
		title: "Web Application Security Fundamentals",
		description:
			"Learn the basics of web application security, including OWASP Top 10 vulnerabilities and mitigation strategies.",
		image: "bg-gradient-to-br from-red-500 to-orange-600",
		duration: "8 hours",
	},
	{
		id: 2,
		title: "Network Security & Penetration Testing",
		description:
			"Master network security concepts and hands-on penetration testing techniques using industry-standard tools.",
		image: "bg-gradient-to-br from-blue-500 to-cyan-600",
		duration: "12 hours",
	},
	{
		id: 3,
		title: "Cryptography & Data Protection",
		description:
			"Deep dive into cryptographic algorithms, key management, and data protection best practices.",
		image: "bg-gradient-to-br from-purple-500 to-pink-600",
		duration: "10 hours",
	},
	{
		id: 4,
		title: "Incident Response & Forensics",
		description:
			"Learn how to respond to security incidents and conduct digital forensics investigations.",
		image: "bg-gradient-to-br from-green-500 to-teal-600",
		duration: "15 hours",
	},
	{
		id: 5,
		title: "Cloud Security Architecture",
		description:
			"Understand cloud security models, compliance frameworks, and secure cloud deployment strategies.",
		image: "bg-gradient-to-br from-indigo-500 to-blue-600",
		duration: "9 hours",
	},
	{
		id: 6,
		title: "Social Engineering & OSINT",
		description:
			"Explore social engineering techniques and open-source intelligence gathering methods.",
		image: "bg-gradient-to-br from-yellow-500 to-orange-600",
		duration: "6 hours",
	},
];

export default function HomePage() {
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>

			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="mb-4 font-bold text-4xl text-white">
						Master Information Security
					</h1>
					<p className="max-w-2xl text-slate-300 text-xl">
						Learn from industry experts and advance your cybersecurity skills
						with hands-on courses designed for real-world scenarios.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{courses.map((course) => (
						<Link key={course.id} href={`/course/${course.id}`}>
							<Card className="h-full cursor-pointer border-slate-800 bg-slate-900 transition-all duration-200 hover:scale-105 hover:border-slate-700">
								<CardHeader className="pb-3">
									<div
										className={`h-32 w-full rounded-lg ${course.image} mb-3 flex items-center justify-center`}
									>
										<Shield className="h-12 w-12 text-white opacity-80" />
									</div>
									<CardTitle className="text-lg text-white leading-tight">
										{course.title}
									</CardTitle>
								</CardHeader>
								<CardContent className="pt-0">
									<CardDescription className="mb-3 text-slate-400 text-sm">
										{course.description}
									</CardDescription>
									<div className="flex items-center text-slate-500 text-sm">
										<Clock className="mr-1 h-4 w-4" />
										{course.duration}
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
