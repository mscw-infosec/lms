import { Clock, Shield, ShieldQuestionIcon } from "lucide-react";

export default function MOSHPage() {
	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
			<div className="container mx-auto px-4 py-16 md:py-24">
				<div className="mx-auto max-w-2xl text-center">
					{/* Icon */}
					<div className="mb-8 flex justify-center">
						<div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30">
							<Shield className="h-12 w-12 text-red-600 dark:text-red-400" />
						</div>
					</div>

					{/* Title */}
					<h1 className="mb-4 font-bold text-4xl text-slate-900 md:text-5xl dark:text-slate-50">
						Московская олимпиада школьников
					</h1>
					<p className="mb-8 text-slate-600 text-xl dark:text-slate-400">
						МОШ по информационной безопасности
					</p>

					{/* Main content */}
					<div className="mb-8 rounded-lg border border-slate-200 bg-white p-8 shadow-sm md:p-12 dark:border-slate-700 dark:bg-slate-800">
						<div className="mb-6 flex items-center justify-center gap-3 text-red-600 dark:text-red-400">
							<Clock className="h-5 w-5" />
							<p className="font-medium text-lg">Олимпиада завершилась</p>
						</div>

						<p className="mb-6 text-lg text-slate-600 dark:text-slate-300">
							Задачи олимпиады были доступны по адресу{" "}
							<a
								href="https://mosh.infosec.moscow"
								className="text-red-600 hover:underline dark:text-red-400"
							>
								mosh.infosec.moscow
							</a>
							.
						</p>

						<div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
							<h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200">
								<ShieldQuestionIcon className="h-6 w-6" />
								Как принять участие?
							</h3>
							<p className="text-blue-800 text-sm dark:text-blue-300">
								Для участия необходимо зарегистрироваться на сайте{" "}
								<a
									href="https://my.sirius.online/activity-page/olymp:mosh-secr-2026"
									className="text-red-600 hover:underline dark:text-red-400"
								>
									Сириус.Онлайн
								</a>
								. Важно учесть, что ваша почта на сайте должна совпадать с
								почтой вашего Яндекс.ID - он потребуется для получения доступа к
								заданиям.
							</p>
						</div>

						<p className="text-slate-500 text-sm dark:text-slate-400">
							Если у вас возникли вопросы, напишите нам на{" "}
							<a
								href="mailto:ib@mosolymp.ru"
								className="text-red-600 hover:underline dark:text-red-400"
							>
								ib@mosolymp.ru
							</a>
							.
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
