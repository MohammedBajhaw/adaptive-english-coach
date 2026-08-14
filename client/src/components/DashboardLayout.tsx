import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import {
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  CircleUserRound,
  Flame,
  LayoutDashboard,
  LogIn,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "نظرة اليوم", path: "/" },
  { icon: BrainCircuit, label: "المعايرة", path: "/diagnostic" },
  { icon: BookOpenCheck, label: "القواعد", path: "/grammar" },
  { icon: MessageCircle, label: "محادثة", path: "/conversation" },
  { icon: ChartNoAxesCombined, label: "استماع", path: "/listening" },
  { icon: BookOpenCheck, label: "البطاقات", path: "/cards" },
  { icon: ChartNoAxesCombined, label: "التقارير", path: "/reports" },
  { icon: Settings2, label: "خطتي", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();

  return (
    <div className="app-grid min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[278px] flex-col border-l border-white/70 bg-[#123b3b] px-5 py-6 text-white lg:flex">
        <button onClick={() => setLocation("/")} className="mb-12 flex items-center gap-3 text-right" aria-label="الذهاب إلى نظرة اليوم">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d8ad4d] text-[#123b3b] shadow-lg"><Flame className="h-5 w-5" /></div>
          <div><p className="text-lg font-bold tracking-tight">مهندس الإنجليزية</p><p className="text-xs text-emerald-100/70">مسار شخصي متدرّج</p></div>
        </button>
        <nav className="space-y-2" aria-label="التنقل الرئيسي">
          {menuItems.map(item => {
            const active = location === item.path;
            return <button key={item.path} onClick={() => setLocation(item.path)} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium ${active ? "bg-white text-[#123b3b] shadow-sm" : "text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}>
              <span className="flex items-center gap-3"><item.icon className="h-[18px] w-[18px]" />{item.label}</span>{active && <ChevronLeft className="h-4 w-4" />}
            </button>;
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/8 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/12"><CircleUserRound className="h-5 w-5" /></div>
            <div className="min-w-0 text-right"><p className="truncate text-sm font-semibold">{isAuthenticated ? user?.name || "متعلم" : "وضع المعاينة"}</p><p className="mt-0.5 text-xs text-emerald-50/65">{isAuthenticated ? "ملفك الشخصي نشط" : "سجل الدخول لحفظ تقدمك"}</p></div>
          </div>
          {isAuthenticated ? <button onClick={logout} className="mt-4 text-xs text-emerald-100 underline underline-offset-4">تسجيل الخروج</button> : <Button onClick={() => startLogin()} className="mt-4 w-full bg-[#d8ad4d] text-[#123b3b] hover:bg-[#e8bf62]"><LogIn className="ml-2 h-4 w-4" />تسجيل الدخول</Button>}
        </div>
      </aside>
      <div className="min-h-screen lg:mr-[278px]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-right lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[#d8ad4d]"><Flame className="h-4 w-4" /></div><span className="text-sm font-bold">مهندس الإنجليزية</span></button>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[#55a578]" />نظامك يتعلم معك، لا يحكم عليك من البداية.</div>
            {!isAuthenticated && <Button size="sm" onClick={() => startLogin()} className="bg-primary text-primary-foreground"><LogIn className="ml-1.5 h-4 w-4" />حفظ تقدمي</Button>}
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 pb-24 lg:px-10 lg:py-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-white/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="التنقل على الهاتف">
          {menuItems.map(item => { const active = location === item.path; return <button key={item.path} onClick={() => setLocation(item.path)} className={`flex min-w-15 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}><item.icon className="h-5 w-5" /><span>{item.label}</span></button>; })}
        </nav>
      </div>
    </div>
  );
}
