import { Logo } from "@/components/logo";
import { Render } from "@/components/render";
import { ResultsWall, TeamPhoto } from "@/components/results";
import marks from "@/lib/path-marks.json";
import {
	ArrowRight,
	Award,
	Calendar,
	Clock,
	FileWarning,
	Info,
	PersonStanding,
	Send,
	Shield,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";

const LMS = "https://lms.infosec.moscow";
const EMAIL = "trainers@infosec.moscow";
const TELEGRAM = "infosec_moscow";

const facts = [
	{
		icon: Clock,
		title: "8 месяцев",
		text: "3 дня регулярных занятий в неделю: онлайн-лекции и очные семинары в Москве",
	},
	{
		icon: Zap,
		title: "Интенсивы",
		text: "Мы проводим 3-5 дней занятий с утра до вечера перед каждым этапом олимпиады",
	},
	{
		icon: PersonStanding,
		title: "Кто преподаёт",
		text: "Практикующие специалисты и студенты",
	},
	{ icon: Sparkles, title: "Бесплатно", text: "Главное - занимайтесь" },
];

const tracks = [
	{
		render: "icon_offense",
		alt: "Замок",
		title: "Наступательная кибербезопасность",
		text: "Атаки на web-приложения, reverse engineering, современная криптография",
	},
	{
		render: "icon_defense",
		alt: "Сервер",
		title: "Оборонительная кибербезопасность",
		text: "Администрирование Linux-систем, Threat Hunting, компьютерные сети, программирование",
	},
	{
		render: "icon_forensics",
		alt: "Лупа",
		title: "Работа с инцидентами ИБ",
		text: "Форензика памяти и сетевая форензика, работа с артефактами инцидентов, анализ кода",
	},
	{
		render: "icon_law",
		alt: "Стопка книг",
		title: "Нормативная база",
		text: "Современное российское и международное регулирование ИБ, стандарты IT-отрасли",
	},
];

const timeline = [
	{ title: "Сбор заявок", date: "1-13 сен" },
	{ title: "Отборочный тест", date: "13 сен" },
	{ title: "Результаты теста", date: "15-17 сен" },
	{ title: "Входной тест", date: "19 сен" },
	{ title: "Начало занятий", date: "Октябрь" },
];

const path = [
	"Отбор в сборную",
	"Занятия весь год",
	"Отборочные этапы ВсОШ",
	"Финал ВсОШ",
];

const outcomes = [
	{
		icon: Award,
		title: "Шанс поехать на финал ВсОШ",
		text: "Успешно прошедшие все отборочные этапы олимпиады поедут на заключительный этап",
	},
	{
		icon: Users,
		title: "Сообщество",
		text: "Уникальное сообщество школьников-единомышленников со схожими интересами",
	},
	{
		icon: Shield,
		title: "Интересную практику",
		text: "Мы делаем интересные задания для участников сборной, а также храним большой архив задач олимпиады",
	},
	{
		icon: Calendar,
		title: "Рекомендации",
		text: "Преподаватели готовы рекомендовать талантливых выпускников на стажировки в ведущие IT‑компании и при поступлении в университеты",
	},
];

const steps = [
	{ title: "Подайте заявку", text: "Расскажите нам немного о себе" },
	{ title: "Пройдите тест", text: "Потребуется ПК и доступ к сети" },
	{ title: "Получите приглашение", text: "Мы свяжемся со всеми после теста" },
];

function SectionTitle({ title, lead }: { title: string; lead?: string }) {
	return (
		<div className="max-w-2xl">
			<h2 className="font-bold font-display text-3xl tracking-tight sm:text-4xl">
				{title}
			</h2>
			{lead && <p className="mt-4 text-base text-muted sm:text-lg">{lead}</p>}
		</div>
	);
}

function Faq({
	q,
	children,
}: {
	q: string;
	children: React.ReactNode;
}) {
	return (
		<article className="border-line border-t py-6 first:border-t-0 first:pt-0">
			<h3 className="font-semibold text-lg">{q}</h3>
			<div className="mt-3 text-muted leading-relaxed">{children}</div>
		</article>
	);
}

const link = "font-semibold text-accent-strong hover:underline";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col overflow-x-clip">
			<header className="sticky top-3 z-40">
				<div className="container-page">
					<div className="flex h-14 items-center gap-2 rounded-full border border-line bg-surface/75 pr-2 pl-4 shadow-[var(--shadow)] backdrop-blur-xl">
						<a href="/" className="flex min-w-0 items-center gap-2">
							<Logo className="h-7 w-7 shrink-0" />
							<span className="truncate font-bold font-display text-sm sm:text-base">
								infosec.moscow
							</span>
						</a>
						<nav className="ml-6 hidden gap-1 whitespace-nowrap text-sm lg:flex">
							{[
								["#program", "О занятиях"],
								["#curriculum", "Программа"],
								["#admissions", "Поступление"],
								["#faq", "FAQ"],
							].map(([href, label]) => (
								<a
									key={href}
									href={href}
									className="rounded-full px-3 py-2 font-medium text-muted transition-colors hover:bg-accent-soft hover:text-accent"
								>
									{label}
								</a>
							))}
						</nav>
					</div>
				</div>
			</header>

			<main className="flex-1">
				<section>
					<div className="container-page grid items-center gap-10 pt-16 pb-20 sm:pt-20 sm:pb-28 lg:grid-cols-[1.15fr_0.85fr]">
						<div>
							<h1 className="font-bold font-display text-[2rem] leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.6rem]">
								Сборная Москвы{" "}
								<span className="text-accent">на ВсОШ по&nbsp;ИБ</span>
								<span className="caret" />
							</h1>
							<p className="mt-6 max-w-xl text-base text-muted leading-relaxed md:text-lg">
								Обучение навыкам в области информационной безопасности для
								школьников на протяжении всего учебного года, занятия с
								преподавателями онлайн и оффлайн, интересные задачи и крутое
								сообщество учеников-единомышленников.
							</p>
							<div className="mt-8 flex flex-col gap-3 sm:flex-row">
								<a href={LMS} className="btn btn-primary">
									Открыть LMS <ArrowRight className="h-4 w-4" />
								</a>
							</div>
						</div>
						<div className="relative mx-auto aspect-square w-full max-w-[20rem] sm:max-w-[26rem] lg:max-w-none">
							<div className="glow inset-[18%]" />
							<div className="-translate-x-1/2 absolute bottom-[4%] left-1/2 h-[7%] w-[42%] rounded-[50%] bg-[rgb(255_30_50/0.22)] blur-xl" />
							<div
								className="hero-shield absolute inset-0"
								role="img"
								aria-label="Объёмный красный щит - логотип сборной"
							/>
						</div>
					</div>
				</section>

				<section>
					<div className="container-page">
						<ResultsWall />
						<TeamPhoto />
					</div>
				</section>

				<section id="program" className="scroll-mt-24 py-20 sm:py-28">
					<div className="container-page">
						<SectionTitle title="О занятиях" />
						<div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
							{facts.map(({ icon: Icon, title, text }) => (
								<div key={title} className="tile reveal p-6">
									<span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
										<Icon className="h-5 w-5" />
									</span>
									<div className="mt-5 font-bold font-display text-lg">
										{title}
									</div>
									<p className="mt-1 text-muted text-sm">{text}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				<section id="curriculum" className="scroll-mt-24 py-20 sm:py-28">
					<div className="container-page">
						<SectionTitle
							title="Чему вы научитесь"
							lead="Мы стараемся совмещать теоретические знания с практическими, чтобы научить большему."
						/>
						<div className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-2">
							{tracks.map(({ render, alt, title, text }) => (
								<div
									key={title}
									className="tile reveal group relative flex flex-col overflow-hidden p-6 sm:flex-row sm:items-center sm:gap-2 sm:p-8"
								>
									<div className="relative order-2 flex flex-1 flex-col sm:order-1">
										<h3 className="font-bold font-display text-lg leading-snug">
											{title}
										</h3>
										<p className="mt-3 text-muted text-sm leading-relaxed">
											{text}
										</p>
									</div>
									<Render
										name={render}
										alt={alt}
										width={900}
										height={900}
										sizes="(min-width: 640px) 176px, 144px"
										className="-mx-2 -mt-2 group-hover:-translate-y-1 relative order-1 h-36 w-36 shrink-0 transition-transform duration-500 group-hover:rotate-2 sm:order-2 sm:m-0 sm:h-44 sm:w-44"
									/>
								</div>
							))}
						</div>
					</div>
				</section>

				<section className="py-20 sm:py-28">
					<div className="container-page">
						<SectionTitle title="Что вы получите" />
						<div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
							{outcomes.map(({ icon: Icon, title, text }) => (
								<div key={title} className="tile reveal p-6">
									<span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
										<Icon className="h-5 w-5" />
									</span>
									<div className="mt-5 font-bold font-display text-base leading-snug">
										{title}
									</div>
									<p className="mt-2 text-muted text-sm leading-relaxed">
										{text}
									</p>
								</div>
							))}
						</div>

						<figure className="tile reveal relative mt-4 overflow-hidden">
							<Render
								name="path"
								alt="Четыре ступени к золотому кубку: путь от отбора до финала ВсОШ"
								width={2400}
								height={1200}
								sizes="(min-width: 1152px) 1152px, 100vw"
								className="block h-auto w-full"
							/>
							<figcaption className="absolute top-5 left-5 max-w-[16rem] sm:top-8 sm:left-8 md:top-10 md:left-10 md:max-w-xs">
								<div className="hidden font-bold font-display text-2xl leading-tight md:block lg:text-3xl">
									Путь до финала ВсОШ
								</div>
							</figcaption>
							{marks.map((m, i) => {
								const last = i === path.length - 1;
								return (
									<div
										key={path[i]}
										className={`absolute flex items-center gap-1.5 ${last ? "-translate-y-1/2 flex-row" : "-translate-x-1/2 -translate-y-full flex-col pb-[2.5%]"}`}
										style={
											last
												? {
														right: `calc(${100 - m.x}% - 1rem)`,
														top: `${m.y}%`,
													}
												: { left: `${m.x}%`, top: `${m.y}%` }
										}
									>
										<span className="hidden whitespace-nowrap rounded-full bg-surface/85 px-3 py-1 font-semibold text-xs backdrop-blur md:block lg:text-sm">
											{path[i]}
										</span>
										<span
											className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-bold font-mono text-[11px] md:h-8 md:w-8 ${last ? "bg-[#d4a034] text-black" : "bg-accent text-accent-ink"}`}
										>
											{String(i + 1).padStart(2, "0")}
										</span>
									</div>
								);
							})}
						</figure>
						<ol className="mt-3 grid grid-cols-2 gap-2 font-mono text-muted text-xs md:hidden">
							{path.map((p, i) => (
								<li
									key={p}
									className="rounded-2xl border border-line px-3 py-2"
								>
									<span className="text-accent">
										{String(i + 1).padStart(2, "0")}
									</span>{" "}
									{p}
								</li>
							))}
						</ol>
					</div>
				</section>

				<section id="admissions" className="scroll-mt-24 py-20 sm:py-28">
					<div className="container-page">
						<SectionTitle
							title="Поступление"
							lead="Отборы проходят несколько раз в год - в начале учебного года и после каждого из отборочных этапов ВсОШ."
						/>
						<ol className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-3">
							{steps.map((s, i) => (
								<li key={s.title} className="tile reveal p-6">
									<span className="font-bold font-display text-5xl text-accent/25">
										{i + 1}
									</span>
									<div className="mt-3 font-bold font-display text-lg">
										{s.title}
									</div>
									<p className="mt-1 text-muted text-sm">{s.text}</p>
								</li>
							))}
						</ol>
						<a
							href={`https://t.me/${TELEGRAM}`}
							target="_blank"
							rel="noreferrer"
							className="tile reveal group relative mt-4 flex flex-col gap-5 overflow-hidden p-6 transition-colors hover:border-accent sm:flex-row sm:items-center sm:p-8"
						>
							<span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--glow)]">
								<Send className="-translate-x-px h-6 w-6" />
							</span>
							<div className="relative flex-1">
								<div className="font-bold font-display text-lg sm:text-xl">
									Следите за новостями
								</div>
								<p className="mt-1 text-muted text-sm">
									Новые наборы, даты тестирований и жизнь сборной - в нашем
									Telegram-канале{" "}
									<span className="font-mono text-text">@{TELEGRAM}</span>
								</p>
							</div>
							<span className="btn btn-primary relative self-start sm:self-auto">
								Подписаться
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</span>
						</a>
					</div>
				</section>

				<section id="timeline" className="scroll-mt-24 py-20 sm:py-28">
					<div className="container-page">
						<SectionTitle title="Таймлайн набора сентября 2026" />
						<div className="reveal mt-8 flex items-start gap-3 rounded-[1.75rem] border border-line bg-surface p-5 sm:items-center sm:p-6">
							<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
								<Info className="h-5 w-5" />
							</span>
							<p className="text-sm leading-relaxed sm:text-base">
								<strong>Набор сентября 2026 года завершён.</strong>{" "}
								<span className="text-muted">
									В течение учебного года могут проходить дополнительные наборы
									- например, после отборочных этапов ВсОШ.
								</span>
							</p>
						</div>
						<ol className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
							{timeline.map((m, i) => (
								<li
									key={m.title}
									className="tile reveal relative flex items-center gap-4 p-5 md:flex-col md:items-start md:gap-6"
								>
									<span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-bold font-mono text-accent-ink text-sm">
										{String(i + 1).padStart(2, "0")}
									</span>
									<div>
										<div className="font-semibold">{m.title}</div>
										<div className="mt-0.5 font-mono text-accent text-sm">
											{m.date}
										</div>
									</div>
								</li>
							))}
						</ol>

						<div className="reveal mt-6 rounded-[1.75rem] border border-accent/25 bg-accent-soft p-6 md:p-8">
							<div className="flex items-start gap-4">
								<span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink sm:inline-flex">
									<FileWarning className="h-5 w-5" />
								</span>
								<div className="text-sm leading-relaxed [&_a:hover]:underline [&_a]:font-semibold [&_a]:text-accent [&_a]:underline-offset-4">
									<h3 className="font-bold font-display text-lg">
										О тестированиях
									</h3>
									<p className="mt-3">
										В 2026/2027 учебном году отбор в сборную состоит из двух
										этапов: отборочного и входного тестов. Первый нужен для
										того, чтобы понять, кто из участников готов к обучению в
										сборной, а второй - для того, чтобы понять уровень знаний
										участников, распределить их по группам и составить
										индивидуальный учебный план для каждого из них. Во втором
										тесте смогут принять участие ученики, успешно прошедшие
										первый тест.
									</p>
									<p className="mt-3">
										<strong>
											Для участия в отборочном тесте необходимо заранее
											заполнить форму с данными об ученике
										</strong>{" "}
										- информацию о том, как это сделать, можно найти на{" "}
										<a
											href="https://цпм.рф/%D0%BA%D1%83%D1%80%D1%81%D1%8B/%d0%bd%d0%b0%d0%b1%d0%be%d1%80-%d0%bf%d0%be-%d0%b8%d0%b1-2026/"
											target="_blank"
											rel="noopener noreferrer"
										>
											сайте ЦПМ
										</a>
										. Без заполненной формы мы не сможем пригласить вас в
										сборную по результатам тестирования.
									</p>
									<p className="mt-3">
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
										<a href="#faq">FAQ</a>.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="faq" className="scroll-mt-24">
					<div className="container-page grid gap-12 py-20 sm:py-28 lg:grid-cols-[0.8fr_1.2fr]">
						<div className="lg:sticky lg:top-28 lg:self-start">
							<h2 className="font-bold font-display text-3xl tracking-tight sm:text-4xl">
								Часто задаваемые вопросы
							</h2>
							<p className="mt-4 text-muted sm:text-lg">
								Не нашли ответ? Напишите нам на{" "}
								<a href={`mailto:${EMAIL}`} className={link}>
									{EMAIL}
								</a>
							</p>
							<div className="tile relative mt-10 hidden aspect-[16/11] overflow-hidden lg:block">
								<Render
									name="faq"
									alt="Красный объёмный знак вопроса и облачка чата"
									className="absolute inset-0 h-full w-full object-cover"
								/>
							</div>
						</div>
						<div>
							<Faq q="Для кого эта программа?">
								Для школьников, учащихся в школах Москвы. Мы принимаем заявки от
								школьников всех возрастов, но участвовать в олимпиаде на
								региональном и заключительном этапе могут только ученики 9-11
								классов.
							</Faq>
							<Faq q="Есть ли у вас занятия для школьников 7-8 классов?">
								Да, мы проводим отдельные занятия для школьников 7-8 классов.
								Вступительные испытания одинаковы для 7-8 и 9-11 классов.
							</Faq>
							<Faq q="Я не в 9-11 классах, но хочу участвовать в заключительном этапе ВсОШ. Так можно?">
								Да, но только если вы пишете олимпиаду за 9, 10 или 11 класс.
								Если вы хотите участвовать за класс выше, начинать нужно со
								школьного этапа - подробности стоит уточнить у ответственного за
								олимпиаду в вашей школе.
							</Faq>
							<Faq q="Как подготовиться к тестированиям?">
								<p>
									Для успешного прохождения отборочного теста участникам
									необходимо обладать базовыми знаниями о работе компьютеров,
									программировании и алгоритмах. Плюсом будут знания о
									криптографии.
								</p>
								<p className="mt-3">
									Входной тест состоит из задач разной сложности и включает в
									себя вопросы по различным темам, включая архитектуру
									компьютера и операционных систем, программирование, алгоритмы,
									безопасность веб-приложений, цифровую криминалистику
									(форензику), reverse engineering бинарных программ.
								</p>
								<p className="mt-3">
									Полезные материалы, которые помогут подготовиться к отбору:
								</p>
								<ol className="mt-2 list-decimal space-y-1 pl-5">
									<li>
										<a
											href="https://course.ugractf.ru"
											target="_blank"
											rel="noreferrer"
											className={link}
										>
											Курс от команды [team Team]
										</a>
									</li>
									<li>
										<a
											href="https://infosec-archive.t.education"
											target="_blank"
											rel="noreferrer"
											className={link}
										>
											Архив задач ВсОШ прошлых лет (с возможностью практики) от
											Т-Образования
										</a>
									</li>
									<li>
										<a
											href="https://vsosh.miem.hse.ru/prepare"
											target="_blank"
											rel="noreferrer"
											className={link}
										>
											Архив задач ВсОШ прошлых лет от МИЭМ НИУ ВШЭ
										</a>
									</li>
								</ol>
							</Faq>
							<Faq q="Как будут проводиться занятия?">
								Мы проводим одну онлайн-лекцию и несколько очных семинаров
								каждую неделю. Очные занятия проводятся в Москве. Перед каждым
								этапом олимпиады проходят интенсивы: 3-5 полных дней занятий на
								базе московской школы.
							</Faq>
						</div>
					</div>
				</section>

				<section>
					<div className="container-page flex flex-col items-start gap-8 pb-20 sm:pb-28 md:flex-row md:items-center md:justify-between">
						<h2 className="font-bold font-display text-3xl tracking-tight sm:text-4xl">
							Готовы учиться с нами?
						</h2>
						<a href={LMS} className="btn btn-primary">
							Открыть LMS <ArrowRight className="h-4 w-4" />
						</a>
					</div>
				</section>
			</main>

			<footer className="border-line border-t py-8">
				<div className="container-page flex flex-col items-center justify-between gap-4 text-muted text-sm sm:flex-row">
					<div className="flex items-center gap-2">
						<Logo className="h-5 w-5" />
						<span className="font-bold font-display text-text">
							infosec.moscow
						</span>
					</div>
					<div className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-xs">
						<a href={`mailto:${EMAIL}`} className="hover:text-accent">
							{EMAIL}
						</a>
						<a
							href={`https://t.me/${TELEGRAM}`}
							target="_blank"
							rel="noreferrer"
							className="hover:text-accent"
						>
							t.me/{TELEGRAM}
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
