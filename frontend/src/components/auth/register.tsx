import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
	const id = useId();

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline">Sign up</Button>
			</DialogTrigger>
			<DialogContent className="w-100">
				<div className="flex flex-col items-center gap-2">
					<DialogHeader>
						<DialogTitle className="sm:text-center">
							Sign up LMS Infosec.moscow
						</DialogTitle>
						<DialogDescription className="sm:text-center">
							We just need a few details to get you started.
						</DialogDescription>
					</DialogHeader>
				</div>

				<form className="space-y-5">
					<div className="space-y-4">
						<div className="*:not-first:mt-2">
							<Label htmlFor={`${id}-name`}>Full name</Label>
							<Input
								id={`${id}-name`}
								placeholder="John Doe"
								type="text"
								required
							/>
						</div>
						<div className="*:not-first:mt-2">
							<Label htmlFor={`${id}-email`}>Email</Label>
							<Input
								id={`${id}-email`}
								placeholder="hi@infosec.moscow"
								type="email"
								required
							/>
						</div>
						<div className="*:not-first:mt-2">
							<Label htmlFor={`${id}-password`}>Password</Label>
							<Input
								id={`${id}-password`}
								placeholder="Enter your password"
								type="password"
								required
							/>
						</div>
					</div>
					<Button type="button" className="w-full">
						Sign up
					</Button>
				</form>

				<div className="before:bg-border after:bg-border flex items-center gap-3 before:h-px before:flex-1 after:h-px after:flex-1">
					<span className="text-muted-foreground text-xs">Or</span>
				</div>

				<div className="grid grid-cols-3 gap-2">
					<Button variant="outline">Passkey</Button>
					<Button variant="outline">Yandex</Button>
					<Button variant="outline">Github</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
