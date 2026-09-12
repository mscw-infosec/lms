"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Award,
	BookOpen,
	Calendar,
	Clock,
	DollarSign,
	FileWarning,
	MapPin,
	PersonStanding,
	Shield,
	Target,
	Users,
	X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function InfoSecAnnualProgram() {
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

	// Handle escape key to close modal
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isLoginModalOpen) {
				setIsLoginModalOpen(false);
			}
		};

		if (isLoginModalOpen) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "unset";
		};
	}, [isLoginModalOpen]);

	const heroDescription = (
		<p className="mt-4 max-w-2xl text-base text-gray-600 md:text-lg">
			Обучение навыкам в области информационной безопасности для школьников на
			протяжении всего учебного года, занятия с преподавателями онлайн и
			оффлайн, интересные задачи и крутое сообщество учеников-единомышленников.
		</p>
	);

	return (
		<div className="flex min-h-screen flex-col">
			<header className="h-12 border-b bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/60 md:h-16 md:px-6">
				<div className="mx-auto flex h-full w-full min-w-0 max-w-6xl items-center">
					<Link href="/" className="flex min-w-0 items-center">
						<Shield className="h-6 w-6 text-red-600 md:h-7 md:w-7" />
						<span className="ml-2 max-w-[14ch] truncate font-bold text-base text-gray-900 md:max-w-none md:text-lg">
							infosec.moscow
						</span>
					</Link>

					<nav className="ml-4 hidden gap-6 md:flex">
						<a
							href="#program"
							className="font-medium text-gray-600 text-sm hover:text-red-600"
						>
							О занятиях
						</a>
						<a
							href="#curriculum"
							className="font-medium text-gray-600 text-sm hover:text-red-600"
						>
							Программа
						</a>
						<a
							href="#admissions"
							className="font-medium text-gray-600 text-sm hover:text-red-600"
						>
							Поступление
						</a>
						<a
							href="#faq"
							className="font-medium text-gray-600 text-sm hover:text-red-600"
						>
							FAQ
						</a>
					</nav>

					{/*<div className="ml-auto flex items-center gap-1.5 md:gap-2">*/}
					{/*	<Button*/}
					{/*		size="sm"*/}
					{/*		className="whitespace-nowrap bg-red-600 hover:bg-red-700"*/}
					{/*		asChild*/}
					{/*		onClick={() => setIsLoginModalOpen(true)}*/}
					{/*	>*/}
					{/*		<Link href="#">Вход</Link>*/}
					{/*	</Button>*/}
					{/*</div>*/}
				</div>
			</header>

			{/* Login Modal */}
			{isLoginModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/50 backdrop-blur-sm"
						onClick={() => setIsLoginModalOpen(false)}
					/>

					{/* Modal */}
					<div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-gray-900 text-lg">
								Вход в систему
							</h2>
							<button
								onClick={() => setIsLoginModalOpen(false)}
								className="text-gray-400 transition-colors hover:text-gray-600"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="py-8 text-center">
							<Shield className="mx-auto mb-4 h-12 w-12 text-red-600" />
							<p className="mb-2 text-gray-600">
								Для перехода в LMS нажмите на кнопку ниже
							</p>
						</div>

						<div className="flex gap-3">
							<Button
								variant="outline"
								className="flex-1 bg-transparent"
								onClick={() => setIsLoginModalOpen(false)}
							>
								Закрыть
							</Button>
							<Button
								className="flex-1 bg-red-600 hover:bg-red-700"
								asChild
								onClick={() => setIsLoginModalOpen(false)}
							>
								<Link href="https://lms.infosec.moscow">Открыть LMS</Link>
							</Button>
						</div>
					</div>
				</div>
			)}

			<main className="flex-1">
				{/* Hero */}
				<section className="w-full bg-gradient-to-br from-gray-50 to-gray-100 py-14 md:py-24 lg:py-28">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-8 w-full max-w-3xl rounded-xl border-2 border-red-600 bg-red-600 px-5 py-4 text-white shadow-lg md:px-8 md:py-5">
								<div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
									<Clock className="h-6 w-6 shrink-0 md:h-7 md:w-7" />
									<p className="font-semibold text-base leading-snug md:text-lg">
										Отборочный тест проходит 13 сентября на платформе{" "}
										<a
											href="https://lms.infosec.moscow"
											className="font-bold underline decoration-2 underline-offset-4 hover:no-underline"
										>
											lms.infosec.moscow
										</a>{" "}
										с 10:00 до 21:00 по московскому времени
									</p>
								</div>
							</div>
							<h1 className="max-w-3xl font-bold text-3xl tracking-tight sm:text-5xl">
								Сборная Москвы на ВсОШ по Информационной Безопасности
							</h1>
							{heroDescription}
							<div className="mt-8 flex flex-col gap-3 sm:flex-row">
								<Button
									size="lg"
									className="bg-red-600 hover:bg-red-700"
									asChild
								>
									<a href="https://lms.infosec.moscow">Открыть LMS</a>
								</Button>
								<Button variant="outline" size="lg" asChild>
									<a href="#timeline">Даты и сроки</a>
								</Button>
							</div>
						</div>
					</div>
				</section>

				{/* Program at a glance */}
				<section id="program" className="w-full py-12 md:py-20">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center gap-2">
										<Clock className="h-5 w-5 text-red-600" />
										<CardTitle className="text-base">
											Продолжительность программы
										</CardTitle>
									</div>
									<CardDescription>8 месяцев - 3 дня в неделю</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center gap-2">
										<MapPin className="h-5 w-5 text-red-600" />
										<CardTitle className="text-base">Формат</CardTitle>
									</div>
									<CardDescription>
										Гибридный: Москва + занятия онлайн
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center gap-2">
										<PersonStanding className="h-5 w-5 text-red-600" />
										<CardTitle className="text-base">Кто преподаёт</CardTitle>
									</div>
									<CardDescription>
										Практикующие специалисты и студенты
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center gap-2">
										<DollarSign className="h-5 w-5 text-red-600" />
										<CardTitle className="text-base">Стоимость</CardTitle>
									</div>
									<CardDescription>
										Это бесплатно! Главное - занимайтесь.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					</div>
				</section>

				{/* Curriculum pillars */}
				<section id="curriculum" className="w-full bg-gray-50 py-12 md:py-20">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						<div className="text-center">
							<h2 className="font-bold text-2xl tracking-tight sm:text-4xl">
								Чему вы научитесь
							</h2>
							<p className="mx-auto mt-3 max-w-2xl text-gray-600">
								Мы стараемся совмещать теоретические знания с практическими,
								чтобы научить большему.
							</p>
						</div>
						<div className="mt-10 grid gap-6 md:grid-cols-2">
							<Card>
								<CardHeader>
									<div className="flex items-center gap-2">
										<Target className="h-6 w-6 text-red-600" />
										<CardTitle>Наступательная кибербезопасность</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="text-gray-600 text-sm">
									Атаки на web-приложения, reverse engineering, современная
									криптография
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<div className="flex items-center gap-2">
										<Shield className="h-6 w-6 text-red-600" />
										<CardTitle>Оборонительная кибербезопасность</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="text-gray-600 text-sm">
									Администрирование Linux-систем, Threat Hunting, компьютерные
									сети, программирование
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<div className="flex items-center gap-2">
										<FileWarning className="h-6 w-6 text-red-600" />
										<CardTitle>Работа с инцидентами ИБ</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="text-gray-600 text-sm">
									Форензика памяти и сетевая форензика, работа с артефактами
									инцидентов, анализ кода
								</CardContent>
							</Card>
							<Card>
								<CardHeader>
									<div className="flex items-center gap-2">
										<BookOpen className="h-6 w-6 text-red-600" />
										<CardTitle>Нормативная база</CardTitle>
									</div>
								</CardHeader>
								<CardContent className="text-gray-600 text-sm">
									Современное российское и международное регулирование ИБ,
									стандарты IT-отрасли
								</CardContent>
							</Card>
						</div>
					</div>
				</section>

				{/* Cohort timeline (mobile-optimized) */}
				<section id="timeline" className="w-full py-12 md:py-20">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						{/*<div className="mb-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">*/}
						{/*<p className="text-gray-800 text-sm font-medium">*/}
						{/*	Сентябрьский отбор 2025 года завершён. Даты следующих отборов будут анонсированы позже.*/}
						{/*</p>*/}
						{/*</div>*/}

						<h3 className="font-bold text-xl">Таймлайн набора сентября 2026</h3>

						{/* Mobile: two rows (3 + 2) to avoid overflow */}
						<div
							className="mt-6 space-y-10 md:hidden"
							aria-label="Таймлайн набора (мобильная версия)"
						>
							{/* Row 1: items 1-3 */}
							<div className="relative pt-8">
								<div className="absolute top-6 right-2 left-2 h-1 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
								<ul className="relative grid grid-cols-3 place-items-center gap-3 px-1">
									{/* 1 */}
									<li className="relative flex min-w-0 flex-col items-center">
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-3.5 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[6.5rem] text-center">
											<div className="font-semibold text-[11px] text-gray-900">
												Сбор заявок
											</div>
											<div className="text-[10px] text-gray-600">1–13 Сен</div>
										</div>
									</li>
									{/* 2 */}
									<li className="relative flex min-w-0 flex-col items-center">
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-3.5 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[6.5rem] text-center">
											<div className="font-semibold text-[11px] text-gray-900">
												Отборочный тест
											</div>
											<div className="text-[10px] text-gray-600">13 Сен</div>
										</div>
									</li>
									{/* 3 */}
									<li className="relative flex min-w-0 flex-col items-center">
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-3.5 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[6.5rem] text-center">
											<div className="font-semibold text-[11px] text-gray-900">
												Результаты теста
											</div>
											<div className="text-[10px] text-gray-600">15-17 Сен</div>
										</div>
									</li>
								</ul>
							</div>

							{/* Row 2: items 4-5 */}
							<div className="relative pt-8">
								<div className="absolute top-6 right-8 left-8 h-1 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
								<ul className="relative grid grid-cols-2 place-items-center gap-3 px-4">
									{/* 4 */}
									<li className="relative flex min-w-0 flex-col items-center">
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-3.5 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[7rem] text-center">
											<div className="font-semibold text-[11px] text-gray-900">
												Входной тест
											</div>
											<div className="text-[10px] text-gray-600">19 Сен</div>
										</div>
									</li>
									{/* 5 */}
									<li className="relative flex min-w-0 flex-col items-center">
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-3.5 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[7rem] text-center">
											<div className="font-semibold text-[11px] text-gray-900">
												Начало занятий
											</div>
											<div className="text-[10px] text-gray-600">1 Окт</div>
										</div>
									</li>
								</ul>
							</div>
						</div>

						{/* Desktop: single line, no clipping */}
						<div
							className="relative mt-8 hidden pt-10 md:block"
							aria-label="Таймлайн набора (десктоп)"
						>
							<div className="absolute top-8 right-4 left-4 h-1 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
							<ul className="relative grid grid-cols-5 place-items-center gap-4 px-2">
								{[
									{ title: "Сбор заявок", date: "1–13 Сен" },
									{ title: "Отборочный тест", date: "13 Сен" },
									{ title: "Результаты теста", date: "15–17 Сен" },
									{ title: "Входной тест", date: "19 Сен" },
									{ title: "Начало занятий", date: "1 Окт" },
								].map((m) => (
									<li
										key={m.title}
										className="relative flex min-w-0 flex-col items-center"
									>
										<span className="relative z-10 inline-flex items-center justify-center">
											<span className="h-4 w-4 rounded-full bg-white shadow-sm ring-2 ring-red-600">
												<span className="block h-2 w-2 translate-x-1 translate-y-1 rounded-full bg-red-600" />
											</span>
										</span>
										<span className="mt-1 h-4 w-0.5 rounded-full bg-gray-300" />
										<div className="mt-2 w-full min-w-0 max-w-[9rem] text-center">
											<div className="font-semibold text-gray-900 text-xs">
												{m.title}
											</div>
											<div className="text-[11px] text-gray-600">{m.date}</div>
										</div>
									</li>
								))}
							</ul>
						</div>

						<p className="sr-only">
							Таймлайн: сбор заявок, отборочный тест, проверка теста,
							результаты, начало занятий.
						</p>

						<div className="mt-10 rounded-lg border border-red-100 bg-red-50 p-5 md:p-6">
							<div className="flex items-start gap-3">
								<FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
								<div>
									<h4 className="font-semibold text-base text-gray-900">
										О тестированиях
									</h4>
									<p className="mt-2 text-gray-700 text-sm leading-relaxed">
										В 2026/2027 учебном году отбор в сборную состоит из двух
										этапов: отборочного и входного тестов. Первый нужен для
										того, чтобы понять, кто из участников готов к обучению в
										сборной, а второй - для того, чтобы понять уровень знаний
										участников, распределить их по группам и составить
										индивидуальный учебный план для каждого из них. Во втором
										тесте смогут принять участие ученики, успешно прошедшие
										первый тест.
									</p>
									<p className="mt-3 text-gray-700 text-sm leading-relaxed">
										<strong>
											Для участия в отборочном тесте необходимо заранее
											заполнить форму с данными об ученике
										</strong>{" "}
										- информацию о том, как это сделать, можно найти на{" "}
										<a
											href="https://цпм.рф/%D0%BA%D1%83%D1%80%D1%81%D1%8B/%d0%bd%d0%b0%d0%b1%d0%be%d1%80-%d0%bf%d0%be-%d0%b8%d0%b1-2026/"
											target="_blank"
											rel="noopener noreferrer"
											className="font-medium text-red-600 hover:underline"
										>
											сайте ЦПМ
										</a>
										. Без заполненной формы мы не сможем пригласить вас в
										сборную по результатам тестирования.
									</p>
									<p className="mt-3 text-gray-700 text-sm leading-relaxed">
										Отборочный тест не является обязательным для учеников,
										являющихся участниками, призёрами или победителями
										заключительного этапа, а также призёрами или победителями
										регионального этапа ВсОШ по ИБ в 2025/2026 учебном году.
										Несмотря на вышеописанные преимущества,{" "}
										<strong>
											заполнение формы с информацией о ученике обязательно даже
											для учеников, использующих право не писать отборочный
											тест.
										</strong>{" "}
										Входной тест обязателен к прохождению для всех. Подробнее
										про подготовку к тестированиям можно узнать в разделе{" "}
										<a
											href="#faq"
											className="font-medium text-red-600 hover:underline"
										>
											FAQ
										</a>
										.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Outcomes ("Что вы получите") as its own section, always stacked below */}
				<section className="w-full bg-white py-8 md:py-16">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						<h3 className="font-bold text-xl">Что вы получите</h3>
						<div className="mt-6 grid gap-6 sm:grid-cols-2">
							<div className="rounded-lg border">
								<div className="pb-2">
									<div className="flex items-center gap-2 p-4">
										<Award className="h-5 w-5 text-red-600" />
										<span className="font-semibold text-base">
											Шанс поехать на финал ВсОШ
										</span>
									</div>
									<p className="px-4 pb-4 text-gray-600 text-sm">
										Успешно прошедшие все отборочные этапы олимпиады поедут на
										заключительный этап
									</p>
								</div>
							</div>
							<div className="rounded-lg border">
								<div className="pb-2">
									<div className="flex items-center gap-2 p-4">
										<Users className="h-5 w-5 text-red-600" />
										<span className="font-semibold text-base">Сообщество</span>
									</div>
									<p className="px-4 pb-4 text-gray-600 text-sm">
										Уникальное сообщество школьников-единомышленников со схожими
										интересами
									</p>
								</div>
							</div>
							<div className="rounded-lg border">
								<div className="pb-2">
									<div className="flex items-center gap-2 p-4">
										<Shield className="h-5 w-5 text-red-600" />
										<span className="font-semibold text-base">
											Интересную практику
										</span>
									</div>
									<p className="px-4 pb-4 text-gray-600 text-sm">
										Мы делаем интересные задания для участников сборной, а также
										храним большой архив задач олимпиады
									</p>
								</div>
							</div>
							<div className="rounded-lg border">
								<div className="pb-2">
									<div className="flex items-center gap-2 p-4">
										<Calendar className="h-5 w-5 text-red-600" />
										<span className="font-semibold text-base">
											Рекомендации
										</span>
									</div>
									<p className="px-4 pb-4 text-gray-600 text-sm">
										Преподаватели готовы рекомендовать талантливых выпускников
										на стажировки в ведущие IT‑компании
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Admissions process */}
				<section id="admissions" className="w-full bg-gray-50 py-12 md:py-20">
					<div className="mx-auto max-w-6xl px-4 md:px-6">
						<div className="text-center">
							<h2 className="font-bold text-2xl tracking-tight sm:text-4xl">
								Поступление
							</h2>
							<p className="mx-auto mt-3 max-w-2xl text-gray-600">
								Отборы проходят несколько раз в год - в начале учебного года и
								после каждого из отборочных этапов ВсОШ.
							</p>
						</div>
						<div className="mt-10 grid gap-6 md:grid-cols-3">
							<Card>
								<CardHeader>
									<div className="flex items-center gap-3">
										<span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 font-semibold text-red-700 text-sm">
											1
										</span>
										<CardTitle>Подайте заявку</CardTitle>
									</div>
									<CardDescription>
										Расскажите нам немного о себе
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<div className="flex items-center gap-3">
										<span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 font-semibold text-red-700 text-sm">
											2
										</span>
										<CardTitle>Пройдите тест</CardTitle>
									</div>
									<CardDescription>
										Потребуется ПК и доступ к сети
									</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<div className="flex items-center gap-3">
										<span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 font-semibold text-red-700 text-sm">
											3
										</span>
										<CardTitle>Получите приглашение</CardTitle>
									</div>
									<CardDescription>
										Мы свяжемся со всеми после теста
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
						<div
							id="apply"
							className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
						>
							<Button size="lg" className="bg-red-600 hover:bg-red-700" asChild>
								<Link href="https://lms.infosec.moscow">Открыть LMS</Link>
							</Button>
							<Button
								variant="outline"
								size="lg"
								asChild
								onClick={() => setIsLoginModalOpen(true)}
							>
								<Link href="#">Уже подали? Входите!</Link>
							</Button>
						</div>
					</div>
				</section>

				{/* FAQ */}
				<section id="faq" className="w-full py-12 md:py-20">
					<div className="mx-auto max-w-3xl px-4 md:px-6">
						<h2 className="font-bold text-2xl tracking-tight sm:text-4xl">
							Часто задаваемые вопросы
						</h2>
						<div className="mt-6 space-y-6">
							<details className="group rounded-lg border p-4">
								<summary className="cursor-pointer list-none font-medium text-gray-900">
									Для кого эта программа?
								</summary>
								<p className="mt-2 text-gray-600 text-sm">
									Для школьников, учащихся в школах Москвы. Мы принимаем заявки
									от школьников всех возрастов, но участвовать в олимпиаде на
									региональном и заключительном этапе могут только ученики 9-11
									классов.
								</p>
							</details>
							<details className="group rounded-lg border p-4">
								<summary className="cursor-pointer list-none font-medium text-gray-900">
									Есть ли у вас занятия для школьников 7-8 классов?
								</summary>
								<p className="mt-2 text-gray-600 text-sm">
									Да, мы проводим отдельные занятия для школьников 7-8 классов.
									Вступительные испытания одинаковы для 7-8 и 9-11 классов.
								</p>
							</details>
							<details className="group rounded-lg border p-4">
								<summary className="cursor-pointer list-none font-medium text-gray-900">
									Я не в 9-11 классах, но хочу участвовать в заключительном
									этапе ВсОШ. Так можно?
								</summary>
								<p className="mt-2 text-gray-600 text-sm">
									Да, но только если вы пишете олимпиаду за класс выше
									(например, девятый). Если вы хотите участвовать за класс выше,
									начинать нужно со школьного этапа - подробности стоит уточнить
									у ответственного за олимпиаду в вашей школе.
								</p>
							</details>
							<details className="group rounded-lg border p-4">
								<summary className="cursor-pointer list-none font-medium text-gray-900">
									Как подготовиться к тестированиям?
								</summary>
								<p className="mt-2 text-gray-600 text-sm">
									Для успешного прохождения отборочного теста участникам
									необходимо обладать базовыми знаниями о работе компьютеров,
									программировании и алгоритмах. Плюсом будут знания о
									криптографии.
									<br />
									<br />
									Входной тест состоит из задач разной сложности и включает в
									себя вопросы по различным темам, включая архитектуру
									компьютера и операционных систем, программирование, алгоритмы,
									безопасность веб-приложений, цифровую криминалистику
									(форензику), reverse engineering бинарных программ.
									<br />
									<br />
									Полезные материалы, которые помогут подготовиться к отбору:
									<br />
									1.{" "}
									<a
										className={"text-red-600"}
										href={"https://course.ugractf.ru"}
										target={"_blank"}
										rel="noreferrer"
									>
										Курс от команды [team Team]
									</a>
									.
									<br />
									2.{" "}
									<a
										className={"text-red-600"}
										href={"https://vsosh.miem.hse.ru/prepare"}
										target={"_blank"}
										rel="noreferrer"
									>
										Архив задач ВсОШ прошлых лет
									</a>
									.
								</p>
							</details>
							<details className="group rounded-lg border p-4">
								<summary className="cursor-pointer list-none font-medium text-gray-900">
									Как будут проводиться занятия?
								</summary>
								<p className="mt-2 text-gray-600 text-sm">
									Мы проводим одну онлайн-лекцию и несколько очных семинаров
									каждую неделю. Очные занятия проводятся в Москве.
								</p>
							</details>
						</div>
					</div>
				</section>

				{/* Final CTA */}
				<section className="w-full border-t bg-gray-50 py-12 md:py-20">
					<div className="mx-auto max-w-6xl px-4 text-center md:px-6">
						<h2 className="font-bold text-2xl tracking-tight sm:text-4xl">
							Готовы учиться с нами?
						</h2>
						<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
							<Button size="lg" className="bg-red-600 hover:bg-red-700" asChild>
								<Link href="https://lms.infosec.moscow">Открыть LMS</Link>
							</Button>
							<Button variant="outline" size="lg" asChild>
								<Link href="#curriculum">Программа</Link>
							</Button>
						</div>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className="w-full border-t bg-white px-4 py-6 md:px-6">
				<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
					<div className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-red-600" />
						<p className="text-gray-600 text-xs">infosec.moscow</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
