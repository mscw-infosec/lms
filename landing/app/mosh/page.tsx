import { Shield, Clock, ShieldQuestionIcon } from "lucide-react"

export default function MOSHPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="mb-8 flex justify-center">
            <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
              <Shield className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            Московская олимпиада школьников
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
            МОШ по информационной безопасности
          </p>

          {/* Main content */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-12 mb-8">
            <div className="flex items-center justify-center gap-3 mb-6 text-green-600 dark:text-green-400">
              <Clock className="w-5 h-5" />
              <p className="text-lg font-medium">Олимпиада идёт</p>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-lg mb-6">
              Задачи олимпиады доступны по адресу <a href="https://mosh.infosec.moscow" className="text-red-600 dark:text-red-400 hover:underline">mosh.infosec.moscow</a>.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <ShieldQuestionIcon className="w-6 h-6" />
                Как принять участие?
              </h3>
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                Для участия необходимо зарегистрироваться на сайте <a href="https://my.sirius.online/activity-page/olymp:mosh-secr-2026" className="text-red-600 dark:text-red-400 hover:underline">Сириус.Онлайн</a>.
                Важно учесть, что ваша почта на сайте должна совпадать с почтой вашего Яндекс.ID - он потребуется для получения доступа к заданиям.
              </p>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Если у вас возникли вопросы, напишите нам на{" "}
              <a href="mailto:ib@mosolymp.ru" className="text-red-600 dark:text-red-400 hover:underline">
                ib@mosolymp.ru
              </a>.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
