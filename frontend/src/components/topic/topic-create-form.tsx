"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  title: string;
  orderIndex: number;
  onTitleChange: (v: string) => void;
  onOrderIndexChange: (v: number) => void;
  onAdd: () => void;
  pending?: boolean;
  disabled?: boolean;
};

export default function TopicCreateForm({
  title,
  orderIndex,
  onTitleChange,
  onOrderIndexChange,
  onAdd,
  pending,
  disabled,
}: Props) {
  const { t } = useTranslation("common");

  const canAdd = !!title.trim() && !pending && !disabled;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-800/50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("topic_title") ?? "Topic title"}
          className="border-slate-700 bg-slate-900 text-white"
        />
        <Input
          type="number"
          value={orderIndex}
          onChange={(e) => onOrderIndexChange(Number(e.target.value))}
          placeholder={t("order_index") ?? "Order"}
          className="w-24 border-slate-700 bg-slate-900 text-white"
        />
        <Button
          size="sm"
          onClick={onAdd}
          disabled={!canAdd}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {t("add_topic") ?? "Add Topic"}
        </Button>
      </div>
    </div>
  );
}
