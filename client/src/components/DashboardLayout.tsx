import { useAuth } from "@/_core/hooks/useAuth";
import InstallPrompt from "@/components/InstallPrompt";
import LoginDialog from "@/components/LoginDialog";
import PasswordDialog from "@/components/PasswordDialog";
import { Button } from "@/components/ui/button";
import {
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronLeft,
  CircleUserRound,
  Ellipsis,
  FilePenLine,
  Flame,
  Headphones,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "نظرة اليوم", path: "/" },
  { icon: BrainCircuit, label: "المعايرة", path: "/diagnostic" },
  { icon: BookOpenCheck, label: "القواعد", path: "/grammar" },
  { icon: MessageCircle, label: "محادثة", path: "/conversation" },
  { icon: Headphones, label: "استماع", path: "/listening" },
  { icon: FilePenLine, label: "كتابة", path: "/writing" },
  { icon: Layers, label: "البطاقات", path: "/cards" },
  { icon: ChartNoAxesCombined, label: "التقارير", path: "/reports" },
  { icon: Settings2, label: "خطتي", path: "/settings" },
];

// Phone navigation keeps the four most-used tabs visible and puts the rest under "المزيد".
const phonePaths = ["/", "/cards", "/grammar", "/conversation"];
const phoneTabs = menuItems.filter(item => phonePaths.includes(item.path));
const moreItems = menuItems.filter(item => !phonePaths.includes(item.path));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout, signInWithEmail, signInWithPassword, signUpWithPassword, requestPasswordReset, updatePassword, recovery, dismissRecovery, isConfigured } = useAuth();
  const [location, setLocation] = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Opening a password-reset link signs the learner in and asks for a new password.
  useEffect(() => { if (recovery) setPasswordOpen(true); }, [recovery]);
  const moreActive = moreItems.some(item => item.path === location);

  function requestSignIn() {
    setMoreOpen(false);
    if (!isConfigured) {
      toast.error("لم تُضبط بيانات Supabase بعد في بيئة النشر.");
      return;
    }
    setLoginOpen(true);
  }

  function go(path: string) {
    setMoreOpen(false);
    setLocation(path);
  }

  return (
    <div className="app-grid min-h-dvh bg-background text-foreground">
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
          {isAuthenticated ? <div className="mt-4 flex items-center justify-between gap-3 text-xs text-emerald-100"><button onClick={() => setPasswordOpen(true)} className="underline underline-offset-4">كلمة المرور</button><button onClick={logout} className="underline underline-offset-4">تسجيل الخروج</button></div> : <Button onClick={requestSignIn} className="mt-4 w-full bg-[#d8ad4d] text-[#123b3b] hover:bg-[#e8bf62]"><LogIn className="ml-2 h-4 w-4" />تسجيل الدخول</Button>}
        </div>
      </aside>
      <div className="min-h-dvh lg:mr-[278px]">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-right lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-[#d8ad4d]"><Flame className="h-4 w-4" /></div><span className="text-sm font-bold">مهندس الإنجليزية</span></button>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[#55a578]" />نظامك يتعلم معك، لا يحكم عليك من البداية.</div>
            {!isAuthenticated && <Button size="sm" onClick={requestSignIn} className="h-10 bg-primary text-primary-foreground"><LogIn className="ml-1.5 h-4 w-4" />حفظ تقدمي</Button>}
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 pb-32 lg:px-10 lg:py-10 lg:pb-10">
          <InstallPrompt />
          {children}
        </main>

        {moreOpen && <button aria-label="إغلاق القائمة" onClick={() => setMoreOpen(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />}
        {moreOpen && (
          <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-3 rounded-3xl border border-border bg-white p-3 shadow-2xl lg:hidden" role="dialog" aria-label="المزيد من الأقسام">
            <div className="mb-1 flex items-center justify-between px-2 py-1"><p className="text-sm font-bold text-primary">المزيد</p><button onClick={() => setMoreOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground" aria-label="إغلاق"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map(item => {
                const active = location === item.path;
                return <button key={item.path} onClick={() => go(item.path)} className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "bg-[#f4f6f3] text-primary"}`}><item.icon className="h-5 w-5" />{item.label}</button>;
              })}
            </div>
            <div className="mt-3 border-t border-border pt-3">
              {isAuthenticated ? (
                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="min-w-0 text-right"><p className="truncate text-sm font-semibold text-primary">{user?.name || "متعلم"}</p><p className="text-xs text-muted-foreground">ملفك الشخصي نشط</p></div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setMoreOpen(false); setPasswordOpen(true); }} className="h-10"><KeyRound className="ml-1.5 h-4 w-4" />كلمة المرور</Button>
                    <Button variant="outline" size="sm" onClick={() => { setMoreOpen(false); void logout(); }} className="h-10"><LogOut className="ml-1.5 h-4 w-4" />خروج</Button>
                  </div>
                </div>
              ) : <Button onClick={requestSignIn} className="h-11 w-full"><LogIn className="ml-2 h-4 w-4" />تسجيل الدخول لحفظ تقدمك</Button>}
            </div>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-white/95 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden" aria-label="التنقل على الهاتف">
          {phoneTabs.map(item => {
            const active = location === item.path;
            return <button key={item.path} onClick={() => go(item.path)} aria-current={active ? "page" : undefined} className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}><item.icon className={`h-[22px] w-[22px] ${active ? "stroke-[2.4]" : ""}`} /><span>{item.label}</span></button>;
          })}
          <button onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen} className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${moreActive || moreOpen ? "text-primary" : "text-muted-foreground"}`}><Ellipsis className="h-[22px] w-[22px]" /><span>المزيد</span></button>
        </nav>
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} signInWithEmail={signInWithEmail} signInWithPassword={signInWithPassword} signUpWithPassword={signUpWithPassword} requestPasswordReset={requestPasswordReset} />
      <PasswordDialog open={passwordOpen} onOpenChange={open => { setPasswordOpen(open); if (!open) dismissRecovery(); }} updatePassword={updatePassword} recovery={recovery} />
    </div>
  );
}
