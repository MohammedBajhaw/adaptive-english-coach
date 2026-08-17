export const contentPromptTemplates = {
  vocabulary: {
    id: "prompt.vocabulary.v1",
    purposeArabic: "توليد بطاقة مفردة تقنية أصلية بمستوى A2/B1 مع تعريف عربي وIPA وخمس جمل وسياق ميكاترونيك.",
    template: "Create one original A2/B1 mechatronics vocabulary card. Return term, IPA, Arabic meaning, part of speech, domain, and five short original engineering sentences with accurate Arabic translations. Avoid words already in the supplied coverage list.",
  },
  grammar: {
    id: "prompt.grammar.v1",
    purposeArabic: "توليد درس قاعدة عربي مع تطبيق مهني وخمسة اختيارات وسؤال كتابي.",
    template: "Create an Arabic explanation for one English grammar point at A2/B1, tied to a mechatronics situation. Include five multiple-choice questions with answers, one short writing prompt, common Arabic-speaker errors, and a source URL list. Do not reuse an existing content ID.",
  },
  conversation: {
    id: "prompt.conversation.v1",
    purposeArabic: "توليد برومبت محادثة قصير مع موضوع وكلمات مترجمة وتقييم من 10.",
    template: "Create an 8–12 minute English conversation prompt for a recent mechatronics graduate. Include topic, Arabic topic translation, five target words with Arabic translations, one-at-a-time questions, and an end evaluation rubric out of 10.",
  },
  listening: {
    id: "prompt.listening.v1",
    purposeArabic: "توليد بطاقة استماع تعتمد رابطًا عامًا مرخصًا أو رسميًا مع أسئلة فهم أصلية.",
    template: "Create an A2/B1 listening activity around a supplied public source URL. Provide original Arabic instructions, three comprehension questions, answers, key phrases, and no copied transcript.",
  },
  writing: {
    id: "prompt.writing.v1",
    purposeArabic: "توليد مهمة كتابة مهنية قصيرة ومعيار تقييم ذاتي قبل التصحيح الخارجي.",
    template: "Create an A2/B1 professional writing task for a mechatronics graduate with an Arabic brief, expected length, target vocabulary, and a self-check rubric. Keep the response original and do not reuse a completed content ID.",
  },
} as const;
