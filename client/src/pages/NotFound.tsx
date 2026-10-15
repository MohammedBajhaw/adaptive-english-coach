import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-lg rounded-[24px] bg-white p-8 text-center soft-shadow">
      <Compass className="mx-auto h-12 w-12 text-[#7652ad]" />
      <h1 className="mt-4 text-2xl font-bold text-primary">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">الرابط الذي فتحته غير متاح. ارجع إلى لوحة اليوم لمتابعة خطتك.</p>
      <Button asChild className="mt-6"><Link href="/"><Home className="ml-2 h-4 w-4" />لوحة اليوم</Link></Button>
    </section>
  );
}
