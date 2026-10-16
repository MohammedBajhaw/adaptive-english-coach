# إعداد تصحيح الكتابة عبر مزود خارجي

يعتمد التطبيق على **واجهة متوافقة مع OpenAI Chat Completions** فقط، ولا يرتبط بمزود محدد. في نسخة GitHub Pages يمر الطلب عبر دالة Supabase Edge Function في `supabase/functions/correct-writing/`. أضف المتغيرات التالية إلى أسرار Supabase بالأمر `supabase secrets set`، ثم انشر الدالة بـ `supabase functions deploy correct-writing`. لا تضعها في كود الواجهة أو في مستودع Git.

| المتغير | الغرض | مثال شكل القيمة |
|---|---|---|
| `AI_CORRECTION_BASE_URL` | رابط واجهة المزود، غالبًا حتى `/v1` | `https://provider.example/v1` |
| `AI_CORRECTION_API_KEY` | مفتاح المزود السري | قيمة سرية من لوحة المزود |
| `AI_CORRECTION_MODEL` | معرّف النموذج الذي اخترته | `model-id` |

تُرسل الدالة فقط طلبات التصحيح إلى `POST /chat/completions`؛ لا يظهر المفتاح في المتصفح. عندما تكون المتغيرات غير موجودة، يبقى التطبيق على المراجعة الذاتية ولا ينفذ أي اتصال خارجي. يجب أن يعيد المزود نصًا بصيغة JSON يتضمن `score` و`correctedText` و`explanationArabic` و`strengths` و`priorities`.

> احتفظ بالمفتاح في أسرار الاستضافة. لا تضعه في `VITE_*` ولا في ملف عميل قابل للتحميل.


## إعداد Gemini (موصى به)

Gemini يوفّر واجهة متوافقة مع OpenAI، فتعمل الدالة معه دون تعديل. القيم التي جرّبناها:

| المتغير | القيمة |
|---|---|
| `AI_CORRECTION_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `AI_CORRECTION_API_KEY` | مفتاح من Google AI Studio (سرّي، لا يُكتب في الكود ولا في المحادثات) |
| `AI_CORRECTION_MODEL` | `gemini-3.5-flash-lite` |
| `AI_CORRECTION_FALLBACK_MODEL` | `gemini-3.1-flash-lite` (اختياري؛ يُستخدم مرة واحدة عند خطأ 429 أو 5xx) |

أسماء الموديلات تتغير مع الوقت (`gemini-2.5-flash` لم يعد متاحًا للحسابات الجديدة)، لذلك اسم الموديل سرّ يمكن تغييره من لوحة Supabase دون تعديل الكود. للاطلاع على الموديلات المتاحة لمفتاحك:

```bash
curl -H "x-goog-api-key: $KEY" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"
```
