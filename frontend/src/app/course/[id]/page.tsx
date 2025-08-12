"use client";

import {
    type TopicResponseDTO,
    type UpsertCourseResponseDTO,
    getCourseById,
    getCourseTopics,
    editCourse,
} from "@/api/courses";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    BookOpen,
    CheckCircle2,
    ChevronDown,
    Clock,
    Edit,
    Save,
    X,
    HelpCircle,
    Home,
    Loader2,
    Play,
    Shield,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserStore } from "@/store/user";
import { useToast } from "@/components/ui/use-toast";

export default function CoursePage() {
    const { t } = useTranslation("common");
    const { user } = useUserStore();
    const { toast } = useToast();
    const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
    const params = useParams<{ id: string }>();
    const courseId = Number.parseInt(String(params.id));

    const courseQuery = useQuery<UpsertCourseResponseDTO, Error>({
        queryKey: ["course", courseId],
        queryFn: () => getCourseById(courseId),
        enabled: Number.isFinite(courseId),
        retry: false,
    });

    const topicsQuery = useQuery<TopicResponseDTO[], Error>({
        queryKey: ["course-topics", courseId],
        queryFn: async () => {
            const data = await getCourseTopics(courseId);
            return data.sort((a, b) => a.order_index - b.order_index);
        },
        enabled: courseQuery.isSuccess,
        retry: false,
    });

    type LectureItem = {
        id: number;
        title: string;
        type: "lecture" | "task";
        completed: boolean;
    };

    type ModuleItem = {
        id: number;
        title: string;
        lectures: LectureItem[];
    };

    const gradients = useMemo(
        () => [
            "bg-gradient-to-br from-red-500 to-orange-600",
            "bg-gradient-to-br from-blue-500 to-cyan-600",
            "bg-gradient-to-br from-purple-500 to-pink-600",
            "bg-gradient-to-br from-green-500 to-teal-600",
            "bg-gradient-to-br from-indigo-500 to-blue-600",
            "bg-gradient-to-br from-yellow-500 to-orange-600",
        ],
        [],
    );

    const courseImageClass = gradients[courseId % gradients.length];

    const canEdit = user?.role === "Teacher" || user?.role === "Admin";

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState<string | null>("");

    useEffect(() => {
        if (courseQuery.data && !isEditing) {
            setName(courseQuery.data.name ?? "");
            setDescription(courseQuery.data.description ?? "");
        }
    }, [courseQuery.data, isEditing]);

    const saveMutation = useMutation({
        mutationFn: async () =>
            editCourse(courseId, {
                name: name.trim(),
                description: description?.trim() || undefined,
            }),
        onSuccess: async () => {
            toast({ description: t("saved_successfully") || "Saved" });
            await courseQuery.refetch();
            setIsEditing(false);
        },
        onError: (err: unknown) => {
            toast({ description: t("save_failed") || "Failed to save" });
            // keep editing state
        },
    });

    const structure = useMemo<ModuleItem[]>(
        () => [
            {
                id: 1,
                title: "Topics",
                lectures: (topicsQuery.data ?? []).map(
                    (t: TopicResponseDTO): LectureItem => ({
                        id: t.id,
                        title: t.title,
                        type: "lecture",
                        completed: false,
                    }),
                ),
            },
        ],
        [topicsQuery.data],
    );

    if (courseQuery.isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
        );
    }

    if (courseQuery.isError || !courseQuery.data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                {courseQuery.error?.message.includes("401")
                    ? t("course_login_prompt")
                    : t("course_not_found")}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <Header
                onLogin={() => setAuthModal("login")}
                onRegister={() => setAuthModal("register")}
            />

            <main className="container mx-auto px-4 py-8">
                <div className="mx-auto max-w-4xl">
                    {/* Home Button */}
                    <div className="mb-4">
                        <Link href="/">
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                            >
                                <Home className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">{t("back_to_courses")}</span>
                                <span className="sm:hidden">{t("back")}</span>
                            </Button>
                        </Link>
                    </div>
                    {/* Course Header */}
                    <div className="mb-6">
                        <div className="flex flex-col gap-4">
                            {/* Mobile: Image and basic info */}
                            <div className="lg:hidden">
                                <div
                                    className={`h-40 w-full rounded-lg ${courseImageClass} mb-4 flex items-center justify-center`}
                                >
                                    <Shield className="h-12 w-12 text-white opacity-80" />
                                </div>
                                {isEditing ? (
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t("course_name_placeholder") ?? "Course name"}
                                        className="mb-3 border-slate-700 bg-slate-800 text-white"
                                    />
                                ) : (
                                    <h1 className="mb-3 font-bold text-2xl text-white">
                                        {courseQuery.data.name}
                                    </h1>
                                )}
                                {canEdit && (
                                    <div className="mb-3 flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <Button
                                                    onClick={() => saveMutation.mutate()}
                                                    disabled={!name.trim() || saveMutation.isPending}
                                                    className="bg-red-600 text-white hover:bg-red-700"
                                                >
                                                    {saveMutation.isPending ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            {t("saving")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="mr-2 h-4 w-4" />
                                                            {t("save")}
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        setName(courseQuery.data?.name ?? "");
                                                        setDescription(courseQuery.data?.description ?? "");
                                                    }}
                                                    className="border-slate-700 bg-transparent text-slate-300 hover:bg-transparent active:bg-transparent focus:bg-transparent"
                                                >
                                                    <X className="mr-2 h-4 w-4" />
                                                    {t("cancel")}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setIsEditing(true)}
                                                className="bg-transparent text-slate-300 hover:bg-transparent hover:text-white active:bg-transparent focus:bg-transparent transition-none"
                                            >
                                                <Edit className="mr-2 h-4 w-4" />
                                                {t("edit")}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                <div className="mb-4 flex items-center gap-4 text-slate-400 text-sm">
                                    <div className="flex items-center">
                                        <Clock className="mr-1 h-3 w-3" />
                                        {new Date(courseQuery.data.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <Link href={`/course/${courseId}/learn`}>
                                    <Button
                                        size="default"
                                        className="w-full bg-red-600 text-white hover:bg-red-700"
                                    >
                                        <Play className="mr-2 h-4 w-4" />
                                        {t("start_course")}
                                    </Button>
                                </Link>
                            </div>

                            {/* Desktop: Side by side layout */}
                            <div className="hidden lg:flex lg:gap-8">
                                <div
                                    className={`h-48 w-80 rounded-lg ${courseImageClass} flex flex-shrink-0 items-center justify-center`}
                                >
                                    <Shield className="h-16 w-16 text-white opacity-80" />
                                </div>

                                <div className="flex-1">
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        {isEditing ? (
                                            <Input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder={t("course_name_placeholder") ?? "Course name"}
                                                className="max-w-xl border-slate-700 bg-slate-800 text-white"
                                            />
                                        ) : (
                                            <h1 className="font-bold text-3xl text-white">
                                                {courseQuery.data.name}
                                            </h1>
                                        )}
                                        {canEdit && (
                                            <div className="flex items-center gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            onClick={() => saveMutation.mutate()}
                                                            disabled={!name.trim() || saveMutation.isPending}
                                                            className="bg-red-600 text-white hover:bg-red-700"
                                                        >
                                                            {saveMutation.isPending ? (
                                                                <>
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    {t("saving")}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Save className="mr-2 h-4 w-4" />
                                                                    {t("save")}
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => {
                                                                setIsEditing(false);
                                                                setName(courseQuery.data?.name ?? "");
                                                                setDescription(courseQuery.data?.description ?? "");
                                                            }}
                                                            className="border-slate-700 bg-transparent text-slate-300 hover:bg-transparent active:bg-transparent focus:bg-transparent"
                                                        >
                                                            <X className="mr-2 h-4 w-4" />
                                                            {t("cancel")}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => setIsEditing(true)}
                                                        className="bg-transparent text-slate-300 hover:bg-transparent hover:text-white active:bg-transparent focus:bg-transparent transition-none"
                                                    >
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        {t("edit")}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mb-6 flex items-center gap-6 text-slate-400">
                                        <div className="flex items-center">
                                            <Clock className="mr-2 h-4 w-4" />
                                            {new Date(
                                                courseQuery.data.created_at,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <Link href={`/course/${courseId}/learn`}>
                                        <Button
                                            size="lg"
                                            className="bg-red-600 text-white hover:bg-red-700"
                                        >
                                            <Play className="mr-2 h-5 w-5" />
                                            {t("start_course")}
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Course Description */}
                    <Card className="mb-8 border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">{t("about_course")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isEditing ? (
                                <Textarea
                                    value={description ?? ""}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t("course_description_placeholder") ?? "Description"}
                                    className="min-h-32 border-slate-700 bg-slate-800 text-white"
                                />
                            ) : (
                                <div className="whitespace-pre-line text-slate-300">
                                    {courseQuery.data.description ?? t("no_description")}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Course Structure */}
                    <Card className="border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">
                                {t("course_structure")}
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                {t("course_structure_modules_lessons", {
                                    modules: structure.length,
                                    lessons: structure.reduce(
                                        (acc, m) => acc + m.lectures.length,
                                        0,
                                    ),
                                })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {structure.map((module) => (
                                <Collapsible key={module.id} defaultOpen>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-slate-800 p-4 transition-colors hover:bg-slate-700">
                                        <div className="flex items-center">
                                            <BookOpen className="mr-3 h-5 w-5 text-slate-400" />
                                            <span className="font-medium text-white">
                                                {t("topics")}
                                            </span>
                                        </div>
                                        <ChevronDown className="h-5 w-5 text-slate-400" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2 ml-8 space-y-2">
                                        {module.lectures.map((lecture) => (
                                            <div
                                                key={lecture.id}
                                                className="flex items-center rounded-lg bg-slate-800/50 p-3"
                                            >
                                                <div className="flex flex-1 items-center">
                                                    {lecture.completed ? (
                                                        <CheckCircle2 className="mr-3 h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <div className="mr-3 h-4 w-4 rounded-full border-2 border-slate-600" />
                                                    )}
                                                    {lecture.type === "lecture" ? (
                                                        <Play className="mr-3 h-4 w-4 text-blue-400" />
                                                    ) : (
                                                        <HelpCircle className="mr-3 h-4 w-4 text-orange-400" />
                                                    )}
                                                    <span className="text-slate-300">
                                                        {lecture.title}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </main>

            <AuthModal type={authModal} onClose={() => setAuthModal(null)} />
        </div>
    );
}
