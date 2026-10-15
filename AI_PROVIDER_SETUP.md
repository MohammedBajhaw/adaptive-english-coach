# إعداد تصحيح الكتابة عبر مزود خارجي

يعتمد التطبيق على **واجهة متوافقة مع OpenAI Chat Completions** فقط، ولا يرتبط بمزود محدد. في نسخة GitHub Pages يمر الطلب عبر دالة Supabase Edge Function في `supabase/functions/correct-writing/`. أضف المتغيرات التالية إلى أسرار Supabase بالأمر `supabase secrets set`، ثم انشر الدالة بـ `supabase functions deploy correct-writing`. لا تضعها في كود الواجهة أو في مستودع Git.

| المتغير | الغرض | مثال شكل القيمة |
|---|---|---|
| `AI_CORRECTION_BASE_URL` | رابط واجهة المزود، غالبًا حتى `/v1` | `https://provider.example/v1` |
| `AI_CORRECTION_API_KEY` | مفتاح المزود السري | قيمة سرية من لوحة المزود |
| `AI_CORRECTION_MODEL` | معرّف النموذج الذي اخترته | `model-id` |

تُرسل الدالة فقط طلبات التصحيح إلى `POST /chat/completions`؛ لا يظهر المفتاح في المتصفح. عندما تكون المتغيرات غير موجودة، يبقى التطبيق على المراجعة الذاتية ولا ينفذ أي اتصال خارجي. يجب أن يعيد المزود نصًا بصيغة JSON يتضمن `score` و`correctedText` و`explanationArabic` و`strengths` و`priorities`.

> احتفظ بالمفتاح في أسرار الاستضافة. لا تضعه في `VITE_*` ولا في ملف عميل قابل للتحميل.
