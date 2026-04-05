import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarDays,
  Home,
  Trash2,
  BellRing,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type Task = {
  id: string;
  estateName: string;
  task: string;
  dueDate: string;
  done: boolean;
  createdAt: string;
};

const STORAGE_KEY = "estate-task-manager-v1";
const ALERT_DAYS = 3;

function formatDate(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDaysFromToday(dateString: string) {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dateString));
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getTaskStatus(task: Task) {
  if (task.done) {
    return {
      label: "完了",
      tone: "secondary" as const,
      priority: 99,
      rowClass: "bg-slate-50 border-slate-200",
    };
  }

  const days = diffDaysFromToday(task.dueDate);

  if (days < 0) {
    return {
      label: "期限超過",
      tone: "destructive" as const,
      priority: 0,
      rowClass: "bg-red-50 border-red-200",
    };
  }
  if (days === 0) {
    return {
      label: "本日期限",
      tone: "warning" as const,
      priority: 1,
      rowClass: "bg-orange-50 border-orange-200",
    };
  }
  if (days <= ALERT_DAYS) {
    return {
      label: `あと${days}日`,
      tone: "caution" as const,
      priority: 2,
      rowClass: "bg-yellow-50 border-yellow-200",
    };
  }
  return {
    label: "予定",
    tone: "outline" as const,
    priority: 3,
    rowClass: "bg-white border-slate-200",
  };
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const sa = getTaskStatus(a).priority;
    const sb = getTaskStatus(b).priority;
    if (sa !== sb) return sa - sb;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export default function EstateTaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [estateName, setEstateName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedEstate, setSelectedEstate] = useState<string>("すべて");
  const [search, setSearch] = useState("");
  const [showDueSoonOnly, setShowDueSoonOnly] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Task[];
      setTasks(parsed);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!estateName.trim() || !taskName.trim() || !dueDate) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      estateName: estateName.trim(),
      task: taskName.trim(),
      dueDate,
      done: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [...prev, newTask]);
    setTaskName("");
    setDueDate("");
  };

  const toggleDone = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const estates = useMemo(() => {
    return [
      "すべて",
      ...Array.from(new Set(tasks.map((t) => t.estateName))).sort((a, b) =>
        a.localeCompare(b, "ja")
      ),
    ];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesEstate =
        selectedEstate === "すべて" || t.estateName === selectedEstate;
      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        t.estateName.toLowerCase().includes(keyword) ||
        t.task.toLowerCase().includes(keyword);
      const days = diffDaysFromToday(t.dueDate);
      const matchesDueSoon = !showDueSoonOnly || (!t.done && days <= ALERT_DAYS);
      return matchesEstate && matchesSearch && matchesDueSoon;
    });
  }, [tasks, selectedEstate, search, showDueSoonOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of sortTasks(filteredTasks)) {
      if (!map.has(task.estateName)) map.set(task.estateName, []);
      map.get(task.estateName)!.push(task);
    }

    const entries = Array.from(map.entries());

    const getGroupPriority = (items: Task[]) => {
      return Math.min(...items.map((t) => getTaskStatus(t).priority));
    };

    return entries.sort((a, b) => {
      const pa = getGroupPriority(a[1]);
      const pb = getGroupPriority(b[1]);
      if (pa !== pb) return pa - pb;
      return a[0].localeCompare(b[0], "ja");
    });
  }, [filteredTasks]);

  const alertTasks = useMemo(() => {
    return sortTasks(
      tasks.filter((t) => {
        if (t.done) return false;
        const days = diffDaysFromToday(t.dueDate);
        return days <= ALERT_DAYS;
      })
    );
  }, [tasks]);

  const totalOpen = tasks.filter((t) => !t.done).length;
  const overdueCount = tasks.filter(
    (t) => !t.done && diffDaysFromToday(t.dueDate) < 0
  ).length;
  const dueSoonCount = tasks.filter(
    (t) => !t.done && diffDaysFromToday(t.dueDate) <= ALERT_DAYS
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">邸名別タスク管理</h1>
            <p className="mt-1 text-sm text-slate-600">
              入力は「邸名・やること・期日」だけ。邸名ごとにまとめて確認できます。
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-3 md:w-auto">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">未完了</div>
                <div className="mt-1 text-2xl font-bold">{totalOpen}</div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-xs text-red-600">期限超過</div>
                <div className="mt-1 text-2xl font-bold text-red-700">
                  {overdueCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="text-xs text-orange-600">緊急対応</div>
                <div className="mt-1 text-2xl font-bold text-orange-700">
                  {dueSoonCount}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {alertTasks.length > 0 && (
          <Alert className="rounded-2xl border-amber-300 bg-amber-50">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              <AlertDescription>
                期限超過・本日期限・3日以内のタスクが{" "}
                <span className="font-semibold">{alertTasks.length}件</span>
                あります。
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>タスクを追加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="邸名"
                value={estateName}
                onChange={(e) => setEstateName(e.target.value)}
              />
              <Input
                placeholder="やること"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Button onClick={addTask}>追加する</Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              邸名は一度入力すると、同じ邸名のタスクが自動でまとまって表示されます。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-wrap gap-2">
                {estates.map((estate) => (
                  <Button
                    key={estate}
                    variant={selectedEstate === estate ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setSelectedEstate(estate)}
                  >
                    {estate}
                  </Button>
                ))}
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <Input
                  placeholder="邸名・やることで検索"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button
                  variant={showDueSoonOnly ? "default" : "outline"}
                  className="whitespace-nowrap rounded-xl"
                  onClick={() => setShowDueSoonOnly((prev) => !prev)}
                >
                  緊急対応のみ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {grouped.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-[180px] items-center justify-center p-6 text-slate-500">
                まだタスクがありません。
              </CardContent>
            </Card>
          ) : (
            grouped.map(([estate, estateTasks]) => (
              <Card key={estate}>
                <CardHeader className="rounded-t-2xl border-b bg-slate-50/70">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Home className="h-5 w-5" />
                    {estate}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {estateTasks.map((item) => {
                      const status = getTaskStatus(item);

                      return (
                        <div
                          key={item.id}
                          className={`grid gap-3 rounded-2xl border p-4 transition md:grid-cols-[1fr_auto_auto_auto] md:items-center ${status.rowClass}`}
                        >
                          <div>
                            <div
                              className={`font-medium ${
                                item.done
                                  ? "line-through text-slate-400"
                                  : "text-slate-900"
                              }`}
                            >
                              {item.task}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                              <CalendarDays className="h-4 w-4" />
                              {formatDate(item.dueDate)}
                            </div>
                          </div>

                          <div>
                            <Badge variant={status.tone}>{status.label}</Badge>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => toggleDone(item.id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {item.done ? "未完了に戻す" : "完了"}
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => deleteTask(item.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="border-dashed bg-slate-50/70">
          <CardContent className="p-5 text-sm leading-7 text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <AlertTriangle className="h-4 w-4" />
              運用を単純にするための考え方
            </div>
            <div className="mt-2 space-y-1">
              <p>・入力項目は3つのみです。</p>
              <p>・邸名が同じものは自動でひとまとまりになります。</p>
              <p>・期限超過・本日期限・3日以内は「緊急対応」としてまとめて表示します。</p>
              <p>・データはブラウザ内に保存されるため、ページ再読込でも残ります。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}