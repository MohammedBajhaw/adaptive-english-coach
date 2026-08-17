# حزم المحتوى المحلية

يحتوي كل مجلد أسبوعي على خمسة ملفات JSON: `vocabulary.json` و`grammar.json` و`conversation.json` و`listening.json` و`writing.json`. كل ملف يحتوي سبعة عناصر يومية بمعرف ثابت من الصيغة `skill.wNN.dNN`، مع محتوى أصلي وحقل `promptTemplateId` الذي يشير إلى قالب توليد المحتوى الموثق في `../prompts.ts`.

يُستخدم سجل `learner_content_progress` لتسجيل أول عرض وإكمال ومراجعة كل معرف. لا يُعاد تقديم المعرف نفسه كمحتوى جديد بعد تسجيله، ويمكن أن يعود عند موعد المراجعة فقط.
