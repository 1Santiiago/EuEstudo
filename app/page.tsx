"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronRight,
  CirclePause,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Flame,
  History,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Target,
  TimerReset,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Subject = {
  id: string;
  name: string;
  short: string;
  topic: string;
  color: string;
  goal: number;
  studied: number;
};
type Session = { id: string; subjectId: string; topic: string; minutes: number; questions: number; correct: number; date: string };
type Revision = { id: string; subjectId: string; topic: string; due: string; done: boolean };
type Summary = { id: string; subjectId: string; title: string; content: string; createdAt: string };
type StudyQuestion = { id: string; subjectId: string; summaryId: string; prompt: string; answer: string };
type StudyGoal = { title: string; subtitle: string; examDate: string };
type AppState = {
  goal: StudyGoal;
  subjects: Subject[];
  sessions: Session[];
  revisions: Revision[];
  summaries: Summary[];
  questions: StudyQuestion[];
};
type DeleteTarget = { type: "subject" | "summary" | "revision"; id: string; label: string } | null;
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "meu-estudo-v1";
const STORAGE_MIGRATION_KEY = "meu-estudo-cloud-migration-v1";
const colors = ["#6ee7f7", "#f8d465", "#a7f36b", "#ff9d7a", "#c7a7ff", "#70a5ff"];
const defaultGoal: StudyGoal = {
  title: "Concurso de Tanguá",
  subtitle: "Oficial Administrativo",
  examDate: "2026-11-22",
};
const importedSessions: Session[] = [
  { id: "chat-portugues-2026-09-22", subjectId: "portugues", topic: "Tempos verbais: presente, pretérito e futuro", minutes: 181, questions: 0, correct: 0, date: "22 set., 08:01–11:02" },
  { id: "chat-especificos-2026-09-22", subjectId: "especificos", topic: "PPA, LDO e LOA: diretrizes, objetivos e metas", minutes: 63, questions: 0, correct: 0, date: "22 set., 14:45–15:48" },
];
const initialState: AppState = {
  goal: defaultGoal,
  subjects: [
    { id: "portugues", name: "Língua Portuguesa", short: "Português", topic: "Tempos verbais: presente, pretérito e futuro", color: colors[0], goal: 240, studied: 181 },
    { id: "legislacao", name: "Legislação Municipal", short: "Legislação", topic: "Lei nº 946/2014 e Lei Orgânica", color: colors[1], goal: 180, studied: 0 },
    { id: "especificos", name: "Conhecimentos Específicos", short: "Específicos", topic: "PPA, LDO e LOA: diretrizes, objetivos e metas", color: colors[2], goal: 240, studied: 63 },
  ],
  sessions: importedSessions,
  revisions: [
    { id: "rev-ppa", subjectId: "especificos", topic: "PPA, LDO e LOA", due: "Hoje", done: false },
    { id: "rev-verbos", subjectId: "portugues", topic: "Pretéritos: perfeito, imperfeito e mais-que-perfeito", due: "Amanhã", done: false },
  ],
  summaries: [],
  questions: [],
};

const navItems = [
  { value: "plano", label: "Plano", icon: LayoutDashboard },
  { value: "materias", label: "Matérias", icon: Layers3 },
  { value: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  { value: "historico", label: "Histórico", icon: History },
  { value: "revisoes", label: "Revisões", icon: RotateCcw },
  { value: "ajustes", label: "Ajustes", icon: Settings2 },
];

function normalizeState(raw: Partial<AppState>): AppState {
  const savedSessions = Array.isArray(raw.sessions) ? raw.sessions : [];
  const missingSessions = importedSessions.filter((session) => !savedSessions.some((saved) => saved.id === session.id));
  const importedMinutes = missingSessions.reduce<Record<string, number>>((totals, session) => {
    totals[session.subjectId] = (totals[session.subjectId] ?? 0) + session.minutes;
    return totals;
  }, {});
  const savedSubjects = Array.isArray(raw.subjects) ? raw.subjects : initialState.subjects;
  return {
    goal: raw.goal ?? defaultGoal,
    subjects: savedSubjects.map((subject) => ({ ...subject, studied: subject.studied + (importedMinutes[subject.id] ?? 0) })),
    sessions: [...missingSessions, ...savedSessions],
    revisions: Array.isArray(raw.revisions) ? raw.revisions : initialState.revisions,
    summaries: Array.isArray(raw.summaries) ? raw.summaries : [],
    questions: Array.isArray(raw.questions) ? raw.questions : [],
  };
}

function formatMinutes(total: number) {
  const safe = Math.max(0, Math.round(total));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return hours ? `${hours}h${minutes ? ` ${String(minutes).padStart(2, "0")}min` : ""}` : `${minutes}min`;
}
function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
function daysUntil(date: string) {
  if (!date) return null;
  return Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86400000);
}
function readableDate(date: string) {
  if (!date) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function revisionDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? readableDate(date) : date;
}
function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
function generateQuestions(summary: Summary): StudyQuestion[] {
  const sentences = summary.content
    .split(/\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().replace(/^[-•]\s*/, ""))
    .filter((sentence) => sentence.length >= 18)
    .slice(0, 8);
  return sentences.map((answer, index) => {
    const definition = answer.match(/^(.{2,55}?)\s+(?:é|são|significa|consiste em)\s+(.+)$/i);
    const colon = answer.match(/^([^:]{2,55}):\s*(.+)$/);
    let prompt: string;
    if (colon) prompt = `O que o resumo explica sobre “${colon[1].trim()}”?`;
    else if (definition) prompt = `Como você definiria “${definition[1].trim()}”?`;
    else {
      const anchor = answer.split(/\s+/).slice(0, 7).join(" ").replace(/[.,;:]$/, "");
      prompt = `Segundo o resumo, o que é correto afirmar sobre “${anchor}…”?`;
    }
    return { id: `question-${summary.id}-${index}`, subjectId: summary.subjectId, summaryId: summary.id, prompt, answer };
  });
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [data, setData] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("plano");
  const [activeSubject, setActiveSubject] = useState("portugues");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);
  const [revisionSubject, setRevisionSubject] = useState("portugues");
  const [revisionTopic, setRevisionTopic] = useState("");
  const [revisionDue, setRevisionDue] = useState(tomorrowDate());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [topic, setTopic] = useState("");
  const [questionsDone, setQuestionsDone] = useState("0");
  const [correct, setCorrect] = useState("0");
  const [subjectName, setSubjectName] = useState("");
  const [subjectTopic, setSubjectTopic] = useState("");
  const [subjectHours, setSubjectHours] = useState("3");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryContent, setSummaryContent] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [goalDraft, setGoalDraft] = useState(defaultGoal);
  const stateRef = useRef(data);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const authError = hashParams.get("error_code");
    if (authError === "otp_expired") {
      setLoginError("O link expirou ou já foi usado. Informe seu e-mail e solicite uma nova confirmação.");
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }
    if (!client) {
      setLoginError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para habilitar sua conta.");
      setAuthReady(true);
      return;
    }

    let active = true;
    client.auth.getSession().then(({ data: sessionData, error }) => {
      if (!active) return;
      if (error) setLoginError(error.message);
      setUserId(sessionData.session?.user.id ?? null);
      setUserEmail(sessionData.session?.user.email ?? "");
      setIsAuthenticated(Boolean(sessionData.session?.user));
      setAuthReady(true);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? "");
      setIsAuthenticated(Boolean(user));
      if (!user) setHydrated(false);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("beforeinstallprompt", captureInstall);
    };
  }, []);

  useEffect(() => {
    if (!authReady || !userId) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const supabase = client;
    const accountId = userId;

    let active = true;
    setHydrated(false);
    setSyncError("");
    async function loadAccountData() {
      const { data: row, error } = await supabase
        .from("study_data")
        .select("data")
        .eq("user_id", accountId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSyncError(`Não foi possível carregar seus dados: ${error.message}`);
        return;
      }

      if (row) {
        setData(normalizeState(row.data as Partial<AppState>));
        setHydrated(true);
        return;
      }

      const userStorageKey = `${STORAGE_KEY}:${accountId}`;
      const cached = window.localStorage.getItem(userStorageKey);
      const legacy = window.localStorage.getItem(STORAGE_KEY);
      let initialData = initialState;
      let migratingLegacyData = false;
      try {
        if (cached) initialData = normalizeState(JSON.parse(cached) as Partial<AppState>);
        else if (legacy && !window.localStorage.getItem(STORAGE_MIGRATION_KEY)) {
          initialData = normalizeState(JSON.parse(legacy) as Partial<AppState>);
          migratingLegacyData = true;
        }
      } catch {
        initialData = initialState;
      }

      const { error: saveError } = await supabase.from("study_data").upsert({
        user_id: accountId,
        data: initialData,
        updated_at: new Date().toISOString(),
      });
      if (!active) return;
      if (saveError) {
        setSyncError(`Não foi possível iniciar seu espaço de estudos: ${saveError.message}`);
        return;
      }
      if (migratingLegacyData) window.localStorage.setItem(STORAGE_MIGRATION_KEY, accountId);
      setData(initialData);
      setHydrated(true);
    }

    void loadAccountData();
    return () => { active = false; };
  }, [authReady, userId]);

  useEffect(() => {
    stateRef.current = data;
    setGoalDraft(data.goal);
    if (!hydrated || !userId) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(data));
    const timer = window.setTimeout(async () => {
      const { error } = await client.from("study_data").upsert({
        user_id: userId,
        data,
        updated_at: new Date().toISOString(),
      });
      setSyncError(error ? `Falha ao sincronizar: ${error.message}` : "");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data, hydrated, userId]);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const selected = data.subjects.find((subject) => subject.id === activeSubject) ?? data.subjects[0];
  const totalStudied = data.subjects.reduce((sum, subject) => sum + subject.studied, 0);
  const totalGoal = data.subjects.reduce((sum, subject) => sum + subject.goal, 0);
  const weeklyProgress = totalGoal ? Math.min(100, Math.round((totalStudied / totalGoal) * 100)) : 0;
  const completedRevisions = data.revisions.filter((revision) => revision.done).length;
  const dueRevisions = data.revisions.filter((revision) => !revision.done);
  const totalQuestions = data.sessions.reduce((sum, session) => sum + session.questions, 0);
  const totalCorrect = data.sessions.reduce((sum, session) => sum + session.correct, 0);
  const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const nextSubject = useMemo(() => {
    if (!data.subjects.length) return null;
    return [...data.subjects].sort((a, b) => a.studied / Math.max(1, a.goal) - b.studied / Math.max(1, b.goal))[0];
  }, [data.subjects]);
  const subjectSummaries = data.summaries.filter((summary) => summary.subjectId === activeSubject);
  const subjectQuestions = data.questions.filter((question) => question.subjectId === activeSubject);
  const examDays = daysUntil(data.goal.examDate);

  function beginSession(subjectId = activeSubject) {
    const subject = data.subjects.find((item) => item.id === subjectId);
    if (!subject) return;
    setActiveSubject(subjectId);
    setTopic(subject.topic);
    setSeconds(0);
    setRunning(true);
  }
  function saveSession() {
    if (!selected) return;
    const minutes = Math.max(1, Math.round(seconds / 60));
    const studyTopic = topic.trim() || selected.topic;
    const questionCount = Math.max(0, Number(questionsDone) || 0);
    const correctCount = Math.min(questionCount, Math.max(0, Number(correct) || 0));
    const session: Session = { id: `session-${Date.now()}`, subjectId: selected.id, topic: studyTopic, minutes, questions: questionCount, correct: correctCount, date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date()) };
    const review: Revision = { id: `review-${Date.now()}`, subjectId: selected.id, topic: studyTopic, due: "Amanhã", done: false };
    setData((current) => ({ ...current, subjects: current.subjects.map((subject) => subject.id === selected.id ? { ...subject, studied: subject.studied + minutes, topic: studyTopic } : subject), sessions: [session, ...current.sessions], revisions: [review, ...current.revisions] }));
    setRunning(false); setSeconds(0); setFinishOpen(false); setQuestionsDone("0"); setCorrect("0");
  }
  function addSubject() {
    const name = subjectName.trim();
    if (!name) return;
    const id = `subject-${Date.now()}`;
    const newSubject: Subject = { id, name, short: name.split(/\s+/).slice(0, 2).join(" "), topic: subjectTopic.trim() || "Defina o primeiro assunto", color: colors[data.subjects.length % colors.length], goal: Math.max(30, Math.round((Number(subjectHours) || 1) * 60)), studied: 0 };
    setData((current) => ({ ...current, subjects: [...current.subjects, newSubject] }));
    setActiveSubject(id); setSubjectName(""); setSubjectTopic(""); setSubjectHours("3"); setAddSubjectOpen(false); setActiveTab("materias");
  }
  function saveSummary() {
    if (!selected || !summaryTitle.trim() || !summaryContent.trim()) return;
    const summary: Summary = { id: `summary-${Date.now()}`, subjectId: selected.id, title: summaryTitle.trim(), content: summaryContent.trim(), createdAt: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date()) };
    setData((current) => ({ ...current, summaries: [summary, ...current.summaries] }));
    setSummaryTitle(""); setSummaryContent("");
  }
  function createQuestions(summary: Summary) {
    const generated = generateQuestions(summary);
    setData((current) => ({ ...current, questions: [...generated, ...current.questions.filter((question) => question.summaryId !== summary.id)] }));
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "summary") {
      setData((current) => ({ ...current, summaries: current.summaries.filter((summary) => summary.id !== deleteTarget.id), questions: current.questions.filter((question) => question.summaryId !== deleteTarget.id) }));
    } else if (deleteTarget.type === "revision") {
      setData((current) => ({ ...current, revisions: current.revisions.filter((revision) => revision.id !== deleteTarget.id) }));
    } else {
      const remaining = data.subjects.filter((subject) => subject.id !== deleteTarget.id);
      setData((current) => ({ ...current, subjects: current.subjects.filter((subject) => subject.id !== deleteTarget.id), sessions: current.sessions.filter((session) => session.subjectId !== deleteTarget.id), revisions: current.revisions.filter((revision) => revision.subjectId !== deleteTarget.id), summaries: current.summaries.filter((summary) => summary.subjectId !== deleteTarget.id), questions: current.questions.filter((question) => question.subjectId !== deleteTarget.id) }));
      if (activeSubject === deleteTarget.id) setActiveSubject(remaining[0]?.id ?? "");
    }
    setDeleteTarget(null);
  }
  function toggleRevision(id: string) {
    setData((current) => ({ ...current, revisions: current.revisions.map((revision) => revision.id === id ? { ...revision, done: !revision.done } : revision) }));
  }
  function openRevisionEditor(revision?: Revision) {
    setEditingRevisionId(revision?.id ?? null);
    setRevisionSubject(revision?.subjectId ?? activeSubject ?? data.subjects[0]?.id ?? "");
    setRevisionTopic(revision?.topic ?? "");
    setRevisionDue(revision && /^\d{4}-\d{2}-\d{2}$/.test(revision.due) ? revision.due : tomorrowDate());
    setRevisionOpen(true);
  }
  function saveRevision() {
    if (!revisionSubject || !revisionTopic.trim() || !revisionDue) return;
    if (editingRevisionId) {
      setData((current) => ({ ...current, revisions: current.revisions.map((revision) => revision.id === editingRevisionId ? { ...revision, subjectId: revisionSubject, topic: revisionTopic.trim(), due: revisionDue } : revision) }));
    } else {
      const revision: Revision = { id: `revision-${Date.now()}`, subjectId: revisionSubject, topic: revisionTopic.trim(), due: revisionDue, done: false };
      setData((current) => ({ ...current, revisions: [revision, ...current.revisions] }));
    }
    setRevisionOpen(false);
    setEditingRevisionId(null);
    setRevisionTopic("");
    setRevisionDue(tomorrowDate());
  }
  function saveGoal() {
    if (!goalDraft.title.trim()) return;
    setData((current) => ({ ...current, goal: { ...goalDraft, title: goalDraft.title.trim(), subtitle: goalDraft.subtitle.trim() } }));
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoginError("A conexão com o Supabase não está configurada.");
      return;
    }
    setLoginError("");
    setLoginMessage("");
    const email = loginEmail.trim();
    const result = isSignUp
      ? await client.auth.signUp({ email, password: loginPassword, options: { emailRedirectTo: window.location.origin } })
      : await client.auth.signInWithPassword({ email, password: loginPassword });
    if (result.error) {
      setLoginError(result.error.message);
      return;
    }
    setLoginPassword("");
    if (isSignUp && !result.data.session) {
      setIsSignUp(false);
      setLoginMessage("Conta criada. Confira seu e-mail para confirmar. Se o link vencer, você pode solicitar outro abaixo.");
    }
  }
  async function resendConfirmation() {
    const email = loginEmail.trim();
    if (!email) {
      setLoginError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoginError("");
    setLoginMessage("");
    setResendingConfirmation(true);
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setResendingConfirmation(false);
    if (error) setLoginError(error.message);
    else setLoginMessage("Novo link enviado. Abra o e-mail mais recente para confirmar sua conta.");
  }
  async function logout() {
    await getSupabaseBrowserClient()?.auth.signOut();
    setActiveTab("plano");
    setRunning(false);
  }
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: "get_study_status", title: "Consultar progresso", description: "Retorna objetivo, progresso semanal, matérias e revisões pendentes.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ goal: stateRef.current.goal.title, studiedMinutes: stateRef.current.subjects.reduce((sum, subject) => sum + subject.studied, 0), weeklyGoalMinutes: stateRef.current.subjects.reduce((sum, subject) => sum + subject.goal, 0), subjects: stateRef.current.subjects.map((subject) => subject.name), pendingReviews: stateRef.current.revisions.filter((revision) => !revision.done).length }) }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  if (!authReady || (isAuthenticated && !hydrated)) {
    return <main className="login-screen"><div className="login-loader"><BookOpenCheck /><span>{syncError || "Carregando seu plano…"}</span>{syncError && <Button onClick={() => window.location.reload()}>Tentar novamente</Button>}</div></main>;
  }

  if (!isAuthenticated) {
    return (
      <main className="login-screen">
        <div className="login-glow login-glow-one" /><div className="login-glow login-glow-two" />
        <section className="login-card">
          <div className="login-brand"><div className="brand-mark"><BookOpenCheck /></div><div><strong>Meu Estudo</strong><span>seu plano, suas regras</span></div></div>
          <div className="login-copy"><span><ShieldCheck /> CONTA SEGURA</span><h1>{isSignUp ? "Comece seu plano de estudos." : "Continue de onde parou."}</h1><p>{isSignUp ? "Crie sua conta para salvar seu progresso na nuvem." : "Entre para acessar seu plano, resumos, perguntas e histórico de estudos."}</p></div>
          <form onSubmit={login} className="login-form">
            <label>E-mail<div className="login-input"><Mail /><input type="email" autoComplete="email" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="voce@exemplo.com" /></div></label>
            <label>Senha<div className="login-input"><LockKeyhole /><input type={showPassword ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} minLength={6} required value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Sua senha" /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            {loginMessage && <p className="login-message" role="status">{loginMessage}</p>}
            <Button type="submit" size="lg" className="login-button">{isSignUp ? "Criar conta" : "Entrar"} <ChevronRight /></Button>
          </form>
          {!isSignUp && <button type="button" className="login-footnote login-toggle" onClick={resendConfirmation} disabled={resendingConfirmation}>{resendingConfirmation ? "Enviando…" : "Reenviar confirmação de e-mail"}</button>}
          <button type="button" className="login-footnote login-toggle" onClick={() => { setIsSignUp((value) => !value); setLoginError(""); }}>{isSignUp ? "Já tem uma conta? Entrar" : "Ainda não tem uma conta? Criar conta"}</button>
          <p className="login-footnote">Se a confirmação de e-mail estiver ativa, confirme o cadastro antes de entrar.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      {syncError && <p className="login-error" role="alert">{syncError}</p>}
      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="app-shell">
        <aside className="sidebar">
          <div className="brand"><div className="brand-mark"><BookOpenCheck /></div><div><strong>Meu Estudo</strong><span>seu plano, suas regras</span></div></div>
          <TabsList variant="line" className="nav-list">
            {navItems.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} className="nav-item"><Icon /><span>{label}</span>{value === "revisoes" && dueRevisions.length > 0 && <b>{dueRevisions.length}</b>}</TabsTrigger>)}
          </TabsList>
          <div className="exam-card"><span>{examDays !== null && examDays >= 0 ? "Prazo" : "Objetivo"}</span><strong>{examDays === null ? "Livre" : examDays >= 0 ? `${examDays} dias` : "Encerrado"}</strong><p>{data.goal.subtitle || data.goal.title}<br />{readableDate(data.goal.examDate)}</p></div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div><p className="eyebrow">{data.goal.title.toUpperCase()}</p><h1>Bom estudo, {userEmail.split("@")[0]}.</h1></div>
            <div className="top-actions"><div className="streak"><Flame /><span><strong>{data.sessions.length ? 1 : 0}</strong> dia de sequência</span></div><Button className="start-small" onClick={() => nextSubject && beginSession(nextSubject.id)} disabled={running || !nextSubject}><Play /> Iniciar estudo</Button><Button variant="ghost" size="icon" aria-label="Sair do aplicativo" onClick={logout}><LogOut /></Button></div>
          </header>

          <TabsContent value="plano" className="page-content">
            {nextSubject ? <>
              <section className="hero-grid">
                <article className="focus-card"><div className="focus-top"><div><span className="pill"><Sparkles /> PRÓXIMO DO CICLO</span><h2>{nextSubject.name}</h2><p>{nextSubject.topic}</p></div><div className="subject-orb" style={{ "--orb": nextSubject.color } as React.CSSProperties}>{nextSubject.short.slice(0, 2).toUpperCase()}</div></div><div className="focus-meta"><span><Clock3 /> Bloco sugerido: 45 min</span><span><Target /> {formatMinutes(nextSubject.goal - nextSubject.studied)} restantes na semana</span></div><Button className="primary-cta" onClick={() => beginSession(nextSubject.id)} disabled={running}><Play /> Começar este bloco <ChevronRight /></Button></article>
                <article className="week-card"><div className="card-heading"><div><p>Meta semanal</p><h3>{formatMinutes(totalStudied)} <span>/ {formatMinutes(totalGoal)}</span></h3></div><strong>{weeklyProgress}%</strong></div><Progress value={weeklyProgress} className="week-progress" /><div className="week-days">{["S", "T", "Q", "Q", "S", "S", "D"].map((day, index) => <div key={`${day}-${index}`} className={index === Math.max(0, new Date().getDay() - 1) ? "today" : ""}><span>{day}</span><i className={index === 0 && data.sessions.length ? "filled" : ""} /></div>)}</div><p className="week-note"><Trophy /> Cada bloco concluído aproxima você do objetivo.</p></article>
              </section>
              <section className="section-block"><div className="section-title"><div><p className="eyebrow">SEU CICLO</p><h2>Disciplinas da semana</h2></div><Button variant="outline" onClick={() => setAddSubjectOpen(true)}><Plus /> Adicionar matéria</Button></div><div className="subject-list">{data.subjects.map((subject, index) => { const progress = Math.min(100, Math.round((subject.studied / Math.max(1, subject.goal)) * 100)); return <article className="subject-row" key={subject.id}><div className="order">{String(index + 1).padStart(2, "0")}</div><div className="subject-dot" style={{ background: subject.color }}>{subject.short.slice(0, 1)}</div><div className="subject-main"><div><h3>{subject.name}</h3><p>{subject.topic}</p></div><div className="subject-progress"><Progress value={progress} /><span>{formatMinutes(subject.studied)} de {formatMinutes(subject.goal)}</span></div></div><Button variant="outline" size="icon" aria-label={`Estudar ${subject.name}`} onClick={() => beginSession(subject.id)} disabled={running}><Play /></Button></article>; })}</div></section>
            </> : <div className="empty-state"><Layers3 /><h3>Crie sua primeira matéria</h3><p>Este plano pode acompanhar qualquer concurso, curso ou objetivo.</p><Button onClick={() => setAddSubjectOpen(true)}><Plus /> Adicionar matéria</Button></div>}
          </TabsContent>

          <TabsContent value="materias" className="page-content">
            <section className="page-intro intro-actions"><div><p className="eyebrow">BASE DE CONHECIMENTO</p><h2>Matérias e resumos</h2><span>Adicione disciplinas, guarde seus resumos e transforme o conteúdo em perguntas.</span></div><Button onClick={() => setAddSubjectOpen(true)}><Plus /> Nova matéria</Button></section>
            {data.subjects.length ? <div className="library-layout">
              <aside className="library-subjects">{data.subjects.map((subject) => <button key={subject.id} className={subject.id === activeSubject ? "active" : ""} onClick={() => setActiveSubject(subject.id)}><i style={{ background: subject.color }} /><span><strong>{subject.name}</strong><small>{data.summaries.filter((summary) => summary.subjectId === subject.id).length} resumo(s)</small></span><ChevronRight /></button>)}</aside>
              {selected && <section className="library-detail">
                <div className="knowledge-head"><div><span style={{ color: selected.color }}>{selected.short}</span><h2>{selected.name}</h2><p>{selected.topic}</p></div><Button variant="ghost" size="icon" aria-label={`Excluir ${selected.name}`} onClick={() => setDeleteTarget({ type: "subject", id: selected.id, label: selected.name })}><Trash2 /></Button></div>
                <article className="summary-editor"><div className="editor-title"><FileText /><div><h3>Novo resumo</h3><p>Cole ou escreva o que aprendeu. O texto fica salvo neste navegador.</p></div></div><label>Título<input className="input-control" value={summaryTitle} onChange={(event) => setSummaryTitle(event.target.value)} placeholder="Ex.: PPA — conceito e duração" /></label><label>Conteúdo<Textarea value={summaryContent} onChange={(event) => setSummaryContent(event.target.value)} placeholder="Escreva frases completas para gerar perguntas melhores…" rows={7} /></label><Button onClick={saveSummary} disabled={!summaryTitle.trim() || !summaryContent.trim()}><Plus /> Salvar resumo</Button></article>
                <div className="saved-content"><div className="section-title"><div><p className="eyebrow">ARQUIVADOS</p><h2>Seus resumos</h2></div><span>{subjectSummaries.length} salvo(s)</span></div>{subjectSummaries.length ? <div className="summary-list">{subjectSummaries.map((summary) => <article key={summary.id}><div><span>{summary.createdAt}</span><h3>{summary.title}</h3><p>{summary.content}</p></div><div className="summary-actions"><Button variant="outline" onClick={() => createQuestions(summary)}><Lightbulb /> Gerar perguntas</Button><Button variant="ghost" size="icon" aria-label={`Excluir resumo ${summary.title}`} onClick={() => setDeleteTarget({ type: "summary", id: summary.id, label: summary.title })}><Trash2 /></Button></div></article>)}</div> : <div className="mini-empty"><FileText /><p>Nenhum resumo nesta matéria.</p></div>}</div>
                {subjectQuestions.length > 0 && <div className="question-section"><div className="section-title"><div><p className="eyebrow">TREINO RÁPIDO</p><h2>Perguntas geradas</h2></div><span>{subjectQuestions.length} pergunta(s)</span></div><div className="question-list">{subjectQuestions.map((question, index) => <article key={question.id}><span>QUESTÃO {String(index + 1).padStart(2, "0")}</span><h3>{question.prompt}</h3>{revealed[question.id] ? <div className="answer-box"><strong>Resposta-base</strong><p>{question.answer}</p></div> : <Button variant="outline" onClick={() => setRevealed((current) => ({ ...current, [question.id]: true }))}>Mostrar resposta</Button>}</article>)}</div></div>}
              </section>}
            </div> : <div className="empty-state"><Layers3 /><h3>Nenhuma matéria cadastrada</h3><p>Adicione a primeira disciplina do seu novo objetivo.</p><Button onClick={() => setAddSubjectOpen(true)}><Plus /> Nova matéria</Button></div>}
          </TabsContent>

          <TabsContent value="estatisticas" className="page-content"><section className="page-intro"><p className="eyebrow">SEU DESEMPENHO</p><h2>Estatísticas</h2><span>Veja onde o seu tempo e os seus acertos estão crescendo.</span></section><div className="metric-grid"><article className="metric"><Clock3 /><p>Tempo nesta semana</p><strong>{formatMinutes(totalStudied)}</strong><span>meta de {formatMinutes(totalGoal)}</span></article><article className="metric"><Target /><p>Questões resolvidas</p><strong>{totalQuestions}</strong><span>{totalCorrect} acertos</span></article><article className="metric"><Trophy /><p>Aproveitamento</p><strong>{accuracy}%</strong><span>{totalQuestions ? "continue subindo" : "registre questões"}</span></article></div><article className="chart-card"><div className="section-title"><div><p className="eyebrow">DISTRIBUIÇÃO</p><h2>Tempo por disciplina</h2></div></div><div className="bars">{data.subjects.map((subject) => { const progress = Math.min(100, Math.round((subject.studied / Math.max(1, subject.goal)) * 100)); return <div className="bar-row" key={subject.id}><span>{subject.short}</span><div><i style={{ width: `${Math.max(2, progress)}%`, background: subject.color }} /></div><strong>{formatMinutes(subject.studied)}</strong></div>; })}</div></article></TabsContent>

          <TabsContent value="historico" className="page-content"><section className="page-intro"><p className="eyebrow">REGISTROS</p><h2>Histórico de estudo</h2><span>Cada sessão salva aparece aqui.</span></section><div className="history-list">{data.sessions.length === 0 ? <div className="empty-state"><History /><h3>Seu histórico começa no primeiro bloco</h3><p>Inicie o cronômetro, estude e salve a sessão.</p></div> : data.sessions.map((session) => { const subject = data.subjects.find((item) => item.id === session.subjectId); if (!subject) return null; return <article className="history-row" key={session.id}><div className="subject-dot" style={{ background: subject.color }}>{subject.short.slice(0, 1)}</div><div><h3>{subject.name}</h3><p>{session.topic}</p></div><span>{session.date}</span><strong>{formatMinutes(session.minutes)}</strong>{session.questions > 0 && <b>{session.correct}/{session.questions} questões</b>}</article>; })}</div></TabsContent>

          <TabsContent value="revisoes" className="page-content">
            <section className="page-intro intro-actions"><div><p className="eyebrow">MEMÓRIA EM DIA</p><h2>Revisões programadas</h2><span>Crie, edite e conclua as revisões que quiser.</span></div><Button onClick={() => openRevisionEditor()} disabled={!data.subjects.length}><Plus /> Nova revisão</Button></section>
            <div className="review-summary"><div><RotateCcw /><span><strong>{dueRevisions.length}</strong> pendentes</span></div><div><Check /><span><strong>{completedRevisions}</strong> concluídas</span></div></div>
            <div className="review-list">{data.revisions.length === 0 ? <div className="empty-state"><RotateCcw /><h3>Nenhuma revisão cadastrada</h3><p>Crie uma revisão para uma das suas matérias.</p><Button onClick={() => openRevisionEditor()} disabled={!data.subjects.length}><Plus /> Nova revisão</Button></div> : data.revisions.map((revision) => { const subject = data.subjects.find((item) => item.id === revision.subjectId); if (!subject) return null; return <article className={`review-row ${revision.done ? "done" : ""}`} key={revision.id}><button aria-label={revision.done ? "Reabrir revisão" : "Concluir revisão"} onClick={() => toggleRevision(revision.id)}><Check /></button><div><span style={{ color: subject.color }}>{subject.short}</span><h3>{revision.topic}</h3><p>{revision.done ? "Revisão concluída" : `Vence: ${revisionDate(revision.due)}`}</p></div><div className="review-actions"><Button variant="ghost" size="icon" aria-label={`Editar revisão ${revision.topic}`} onClick={() => openRevisionEditor(revision)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Excluir revisão ${revision.topic}`} onClick={() => setDeleteTarget({ type: "revision", id: revision.id, label: revision.topic })}><Trash2 /></Button><Button variant="outline" onClick={() => beginSession(revision.subjectId)} disabled={revision.done || running}>{revision.done ? "Concluída" : "Revisar"}</Button></div></article>; })}</div>
          </TabsContent>

          <TabsContent value="ajustes" className="page-content">
            <section className="page-intro">
              <p className="eyebrow">PLANO REUTILIZÁVEL</p>
              <h2>Ajustes do aplicativo</h2>
              <span>Atualize seu objetivo, proteja o acesso e instale o Meu Estudo no seu aparelho.</span>
            </section>

            <div className="settings-grid">
              <article className="settings-card">
                <div className="editor-title"><Pencil /><div><h3>Objetivo atual</h3><p>Essas informações aparecem no topo e na contagem regressiva.</p></div></div>
                <div className="settings-form">
                  <label>Nome do objetivo<input className="input-control" value={goalDraft.title} onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Concurso INSS" /></label>
                  <label>Cargo ou descrição<input className="input-control" value={goalDraft.subtitle} onChange={(event) => setGoalDraft((current) => ({ ...current, subtitle: event.target.value }))} placeholder="Ex.: Técnico do Seguro Social" /></label>
                  <label>Data da prova<input className="input-control" type="date" value={goalDraft.examDate} onChange={(event) => setGoalDraft((current) => ({ ...current, examDate: event.target.value }))} /></label>
                </div>
                <Button onClick={saveGoal}><Check /> Salvar objetivo</Button>
              </article>

              <article className="settings-card">
                <div className="editor-title"><ShieldCheck /><div><h3>Sua conta</h3><p>Conta protegida pelo Supabase; seus estudos são sincronizados com segurança.</p></div></div>
                <div className="settings-action-row"><span>{userEmail}</span><Button variant="outline" onClick={logout}><LogOut /> Sair da conta</Button></div>
              </article>

              <article className="settings-card install-card">
                <div className="editor-title"><Download /><div><h3>Instalar como aplicativo</h3><p>Adicione o Meu Estudo à tela inicial para abrir em uma janela própria e continuar acessando a interface mesmo sem conexão.</p></div></div>
                <Button variant="outline" onClick={installApp} disabled={!installPrompt}><Download /> {installPrompt ? "Instalar aplicativo" : "Use o menu do navegador para instalar"}</Button>
              </article>

              <article className="settings-card reuse-card">
                <div><h3>Pronto para o próximo concurso</h3><p>Edite o objetivo acima, entre em <strong>Matérias</strong>, adicione as novas disciplinas e exclua as que não serão mais usadas. Os resumos, perguntas e sessões ficam organizados por matéria.</p></div>
                <Button variant="outline" onClick={() => setActiveTab("materias")}><Layers3 /> Gerenciar matérias</Button>
              </article>
            </div>
          </TabsContent>
        </section>
      </Tabs>

      {running && selected && <section className="timer-dock" aria-live="polite"><div className="timer-subject"><span style={{ background: selected.color }}>{selected.short.slice(0, 1)}</span><div><b>{selected.short}</b><small>{topic || selected.topic}</small></div></div><div className="timer-count"><small>tempo de foco</small><strong>{formatTimer(seconds)}</strong></div><div className="timer-actions"><Button variant="ghost" size="icon" aria-label="Pausar" onClick={() => setRunning(false)}><CirclePause /></Button><Button className="finish-button" onClick={() => { setRunning(false); setFinishOpen(true); }}><Square /> Concluir</Button></div></section>}

      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}><DialogContent className="finish-dialog"><DialogHeader><DialogTitle>Adicionar matéria</DialogTitle><DialogDescription>Cadastre qualquer disciplina. Ela entra automaticamente no seu ciclo.</DialogDescription></DialogHeader><div className="form-grid"><label className="wide">Nome da matéria<input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Ex.: Direito Constitucional" /></label><label className="wide">Primeiro assunto<input value={subjectTopic} onChange={(event) => setSubjectTopic(event.target.value)} placeholder="Ex.: Princípios fundamentais" /></label><label>Meta semanal (horas)<input type="number" min="0.5" step="0.5" value={subjectHours} onChange={(event) => setSubjectHours(event.target.value)} /></label></div><DialogFooter><Button variant="ghost" onClick={() => setAddSubjectOpen(false)}>Cancelar</Button><Button onClick={addSubject} disabled={!subjectName.trim()}><Plus /> Adicionar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={revisionOpen} onOpenChange={setRevisionOpen}><DialogContent className="finish-dialog"><DialogHeader><DialogTitle>{editingRevisionId ? "Editar revisão" : "Nova revisão"}</DialogTitle><DialogDescription>Escolha a matéria, o conteúdo e a data em que deseja revisar.</DialogDescription></DialogHeader><div className="form-grid"><label>Matéria<Select value={revisionSubject} onValueChange={setRevisionSubject}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></label><label>Data da revisão<input type="date" value={revisionDue} onChange={(event) => setRevisionDue(event.target.value)} /></label><label className="wide">Conteúdo a revisar<input value={revisionTopic} onChange={(event) => setRevisionTopic(event.target.value)} placeholder="Ex.: Princípios fundamentais" /></label></div><DialogFooter><Button variant="ghost" onClick={() => setRevisionOpen(false)}>Cancelar</Button><Button onClick={saveRevision} disabled={!revisionSubject || !revisionTopic.trim() || !revisionDue}><Check /> {editingRevisionId ? "Salvar alterações" : "Criar revisão"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}><DialogContent className="finish-dialog"><DialogHeader><DialogTitle>Salvar sessão</DialogTitle><DialogDescription>Registre o assunto e o resultado das questões. Uma revisão será criada para amanhã.</DialogDescription></DialogHeader><div className="form-grid"><label>Disciplina<Select value={activeSubject} onValueChange={setActiveSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></label><label className="wide">Assunto<input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="O que você estudou?" /></label><label>Questões feitas<input type="number" min="0" value={questionsDone} onChange={(event) => setQuestionsDone(event.target.value)} /></label><label>Acertos<input type="number" min="0" max={questionsDone} value={correct} onChange={(event) => setCorrect(event.target.value)} /></label></div><div className="session-total"><TimerReset /><span>Tempo registrado</span><strong>{formatMinutes(Math.max(1, Math.round(seconds / 60)))}</strong></div><DialogFooter><Button variant="ghost" onClick={() => { setFinishOpen(false); setRunning(true); }}>Continuar estudando</Button><Button onClick={saveSession}>Salvar sessão</Button></DialogFooter></DialogContent></Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent className="finish-dialog"><AlertDialogHeader><AlertDialogTitle>Excluir “{deleteTarget?.label}”?</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.type === "subject" ? "A matéria e todos os seus resumos, perguntas, revisões e registros serão removidos deste aparelho." : deleteTarget?.type === "summary" ? "O resumo e as perguntas geradas a partir dele serão removidos." : "A revisão será removida deste aparelho."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}
