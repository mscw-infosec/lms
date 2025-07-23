import Login from "@/components/auth/login";
import Register from "@/components/auth/register";

export default function HomePage() {
	return (
		<main className="min-h-screen flex flex-col items-center justify-center">
			<h1 className="text-6xl">Infosec.Moscow</h1>
			<nav className="w-44 mt-8 flex justify-between">
				<Login />
				<Register />
			</nav>
		</main>
	);
}
