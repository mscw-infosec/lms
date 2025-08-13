"use client";

import { getCourseTopics } from "@/api/courses";
import {
  type ExamAttempt,
  type ExamDTO,
  type PublicTaskDTO,
  getExamTasks,
  getLastAttempt,
  getTopicExams,
  startAttempt,
  patchAttempt,
  stopAttempt,
} from "@/api/exam";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Home,
  Menu,
  Play,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskPlayer } from "@/components/task-player";

export default function LearnPage() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const courseId = Number.parseInt(String(params.id));

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamDTO | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [tasks, setTasks] = useState<PublicTaskDTO[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [noMoreAttempts, setNoMoreAttempts] = useState(false);

  const topicsQuery = useQuery({
    queryKey: ["course-topics", courseId],
    queryFn: async () => {
      const data = await getCourseTopics(courseId);
      return data.sort((a, b) => a.order_index - b.order_index);
    },
    enabled: Number.isFinite(courseId),
    retry: false,
  });

  const examsByTopicQuery = useQuery({
    queryKey: ["topics-exams", topicsQuery.data?.map((t) => t.id) ?? []],
    queryFn: async () => {
      const topics = topicsQuery.data ?? [];
      const entries = await Promise.all(
        topics.map(async (topic) => {
          const exams = await getTopicExams(topic.id).catch(() => []);
          return [topic.id, exams as ExamDTO[]] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number, ExamDTO[]>;
    },
    enabled: topicsQuery.isSuccess,
    retry: false,
  });

  // When exam changes, try to fetch last attempt and tasks if available
  useEffect(() => {
    let ignore = false;
    // reset attempts flag on exam switch
    setNoMoreAttempts(false);
    async function loadAttemptAndTasks() {
      if (!selectedExam) return;
      try {
        const last = await getLastAttempt(selectedExam.id).catch(() => null);
        if (ignore) return;
        if (last)  {
          setAttempt(last);
          // If exam allows only one try and the last attempt is finished, hide Start immediately
          if (!last.active && selectedExam.tries_count === 1) {
            setNoMoreAttempts(true);
          }
        }
        const maybeTasks = await getExamTasks(selectedExam.id).catch(() => []);
        if (ignore) return;
        if (Array.isArray(maybeTasks) && maybeTasks.length > 0) {
          setTasks(maybeTasks);
          setTaskIndex(0);
        } else {
          setTasks([]);
          setTaskIndex(0);
        }
      } catch (_) {
        // noop
      }
    }
    loadAttemptAndTasks();
    return () => {
      ignore = true;
    };
  }, [selectedExam]);

  const startAttemptMutation = useMutation({
    mutationFn: async (examId: string) => startAttempt(examId),
    onSuccess: async (att) => {
      setAttempt(att);
      // tasks should become available now
      const list = await getExamTasks(att.exam_id).catch(() => []);
      setTasks(list);
      setTaskIndex(0);
    },
    onError: async (err: unknown) => {
      // If cannot start due to an active attempt or no tries left, try loading the last attempt and open it
      const { msg, code } = ((): { msg?: string; code?: string } => {
        try {
          if (typeof err === "object" && err) {
            const anyErr: any = err as any;
            const m: string | undefined = anyErr.message ?? anyErr.error ?? anyErr?.response?.data?.error;
            return { msg: m, code: anyErr.code };
          }
        } catch {}
        return {};
      })();

      const activeOrNoTries = (
        (typeof msg === "string" && msg.toLowerCase().includes("can't start exam")) ||
        msg?.toLowerCase().includes("have an active attempt") ||
        msg?.toLowerCase().includes("ran out of attempts")
      );
      const ranOut = typeof msg === "string" && msg.toLowerCase().includes("ran out of attempts");
      if (ranOut) setNoMoreAttempts(true);

      if (selectedExam) {
        // Always try to load last attempt if starting failed
        try {
          const last = await getLastAttempt(selectedExam.id).catch(() => null);
          if (last) {
            setAttempt(last);
            const list = await getExamTasks(selectedExam.id).catch(() => []);
            setTasks(list);
            setTaskIndex(0);
            // Inform user accordingly
            toast({
              description:
                (activeOrNoTries
                  ? (t("opening_current_attempt") || "Opening your current attempt")
                  : (ranOut
                    ? (t("no_attempts_left") || "No attempts left")
                    : (msg ?? (t("opening_current_attempt") || "Opening your current attempt")))),
            });
            return;
          }
        } catch {}
      }

      toast({ description: msg ?? (t("failed_operation") || "Operation failed") });
    },
  });

  const canPrev = taskIndex > 0;
  const canNext = taskIndex < (tasks.length || 0) - 1;

  // Persist progress/answers (best-effort) using attempt patch endpoint
  const patchAttemptMutation = useMutation({
    mutationFn: async (body: unknown) =>
      patchAttempt(selectedExam!.id, body),
  });

  // Stop/finish attempt
  const stopAttemptMutation = useMutation({
    mutationFn: async () => stopAttempt(selectedExam!.id),
    onSuccess: async () => {
      // refresh last attempt
      if (selectedExam) {
        const last = await getLastAttempt(selectedExam.id).catch(() => null);
        if (last) setAttempt(last);
      }
    },
    onError: () => {
      toast({ description: t("failed_operation") || "Operation failed" });
    },
  });

  const handleStart = () => {
    if (!selectedExam || startAttemptMutation.isPending) return;
    startAttemptMutation.mutate(selectedExam.id);
  };

  // Use TaskPlayer for interaction; hook into progress to persist
  function renderInteractiveTask(task: PublicTaskDTO) {
    const onProgress = (questionId: number, hasAnswer: boolean) => {
      // Best-effort patch: store per-task progress; backend body shape may differ.
      // You may adjust payload to match backend expectations.
      patchAttemptMutation.mutate({
        task_id: task.id,
        question_id: questionId,
        has_answer: hasAnswer,
      });
    };
    return (
      <TaskPlayer
        task={{ id: task.id }}
        onComplete={() => {
          // noop here; completion is evaluated client-side in TaskPlayer.
        }}
        onNext={() => {
          setTaskIndex((i) => Math.min(tasks.length - 1, i + 1));
        }}
        onProgress={onProgress}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Header
        onLogin={() => setAuthModal("login")}
        onRegister={() => setAuthModal("register")}
      />
      <div className="flex">
        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            onClick={() => setSidebarOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Close sidebar overlay"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSidebarOpen(false);
              }
            }}
          />
        )}

        {/* Sidebar */}
        <div
          className={`${sidebarOpen ? "w-full sm:w-80" : "w-0"} overflow-hidden border-slate-800 border-r bg-slate-900 transition-all duration-300 ${sidebarOpen ? "fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto" : ""}`}
        >
          <div className="flex items-center justify-between border-slate-800 border-b p-4">
            <h2 className="font-semibold text-white">
              {t("course_structure")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="text-slate-400 hover:text-white sm:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100vh-80px)] space-y-4 overflow-y-auto p-4">
            {topicsQuery.isLoading ? (
              <div className="text-slate-400 text-sm">{t("loading")}</div>
            ) : null}
            {(topicsQuery.data ?? []).map((topic) => (
              <Collapsible key={topic.id} defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-3 transition-colors hover:bg-slate-700">
                  <div className="flex items-center">
                    <BookOpen className="mr-2 h-4 w-4 text-slate-400" />
                    <span className="font-medium text-sm text-white">
                      {topic.title}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {(examsByTopicQuery.data?.[topic.id] ?? []).map((exam) => (
                    <button
                      type="button"
                      key={exam.id}
                      onClick={() => {
                        setSelectedExam(exam);
                        if (
                          typeof window !== "undefined" &&
                          window.innerWidth < 640
                        )
                          setSidebarOpen(false);
                      }}
                      className={`flex w-full items-center rounded-lg p-2 text-left transition-colors ${
                        selectedExam?.id === exam.id
                          ? "bg-red-600 text-white"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <div className="flex flex-1 items-center">
                        <HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 text-orange-400" />
                        <span className="truncate text-sm">
                          {t("exam_card", {
                            type: t(
                              exam.type === "Instant"
                                ? "exam_type_instant"
                                : "exam_type_delayed",
                            ),
                            duration: exam.duration,
                            tries: exam.tries_count,
                          })}
                        </span>
                      </div>
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-slate-800 border-b bg-slate-900 p-3 lg:p-4">
            <div className="flex min-w-0 flex-1 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
              >
                {sidebarOpen ? (
                  <X className="h-4 w-4 lg:h-5 lg:w-5" />
                ) : (
                  <Menu className="h-4 w-4 lg:h-5 lg:w-5" />
                )}
              </Button>
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2 flex-shrink-0 text-slate-400 hover:text-white lg:mr-4"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="truncate font-semibold text-sm text-white lg:text-base">
                {selectedExam ? t("exam") : t("course_structure")}
              </h1>
            </div>

            {selectedExam && tasks.length > 0 ? (
              <div className="flex flex-shrink-0 items-center space-x-1 lg:space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTaskIndex((i) => Math.max(0, i - 1))}
                  disabled={!canPrev}
                  className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
                >
                  <ChevronLeft className="h-3 w-3 lg:mr-1 lg:h-4 lg:w-4" />
                  <span className="hidden sm:inline">{t("previous")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTaskIndex((i) => Math.min(tasks.length - 1, i + 1))
                  }
                  disabled={!canNext}
                  className="border-slate-700 bg-transparent px-2 text-slate-300 text-xs hover:bg-slate-800 lg:px-3 lg:text-sm"
                >
                  <span className="hidden sm:inline">{t("next")}</span>
                  <ChevronRight className="h-3 w-3 lg:ml-1 lg:h-4 lg:w-4" />
                </Button>
                {attempt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => stopAttemptMutation.mutate()}
                    disabled={stopAttemptMutation.isPending || !attempt.active}
                    className="text-red-400 hover:text-red-300"
                    title={attempt.active ? t("finish") ?? "Finish" : t("finished") ?? "Finished"}
                  >
                    {attempt.active ? t("finish") ?? "Finish" : t("finished") ?? "Finished"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 lg:p-6">
            {!selectedExam ? (
              <div className="text-slate-300">
                {t("select_exam") ?? "Select an exam from the left"}
              </div>
            ) : tasks.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900">
                <CardContent className="p-6">
                  <div className="mb-3 text-slate-300">
                    {t("exam_card", {
                      type: t(
                        selectedExam.type === "Instant"
                          ? "exam_type_instant"
                          : "exam_type_delayed",
                      ),
                      duration: selectedExam.duration,
                      tries: selectedExam.tries_count,
                    })}
                  </div>
                  {noMoreAttempts ? (
                    <div className="text-sm text-slate-400">
                      {t("no_attempts_left") || "You have no attempts left for this exam."}
                    </div>
                  ) : (
                    <Button
                      onClick={handleStart}
                      disabled={startAttemptMutation.isPending}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t("start_exam") ?? "Start attempt"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {attempt ? (
                  <div className="text-slate-400 text-xs">
                    {attempt.active ? (t("attempt_active") ?? "Attempt active") : (t("attempt_finished") ?? "Attempt finished")} · {t("started_at") ?? "Started"}: {new Date(attempt.started_at).toLocaleString()}
                  </div>
                ) : null}
                <div className="text-slate-400 text-sm">
                  {t("pagination", {
                    index: taskIndex + 1,
                    total: tasks.length,
                  }) || `${taskIndex + 1} / ${tasks.length}`}
                </div>
                {renderInteractiveTask(tasks[taskIndex]!)}
              </div>
            )}
          </div>
        </div>
      </div>
      {authModal ? (
        <AuthModal type={authModal} onClose={() => setAuthModal(null)} />
      ) : null}
    </div>
  );
}
