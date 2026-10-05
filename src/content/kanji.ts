import type { Example, Jp } from "./types";

/**
 * Words a Taiwanese reader recognises at a glance and therefore reads wrong:
 * the kanji are the same, the meaning is not. `trap` is the Chinese reading
 * the learner has to unlearn, so it is also the decoy in the quiz.
 */
export interface FalseFriend {
  jp: Jp;
  /** What the word means in Japanese. */
  zh: string;
  /** What the same characters say in Chinese — never what the Japanese word means. */
  trap: string;
  example: Example;
}

export const FALSE_FRIENDS: FalseFriend[] = [
  {
    jp: "{勉強|べんきょう}",
    zh: "學習、唸書",
    trap: "勉強、不情願",
    example: { jp: "{毎日|まいにち} {日本語|にほんご} を {勉強|べんきょう}します。", zh: "我每天學日文。" },
  },
  {
    jp: "{手紙|てがみ}",
    zh: "信",
    trap: "衛生紙",
    example: { jp: "{友達|ともだち} に {手紙|てがみ} を {書|か}きます。", zh: "我要寫信給朋友。" },
  },
  {
    jp: "{大丈夫|だいじょうぶ}",
    zh: "沒問題、不要緊",
    trap: "大丈夫、有擔當的男人",
    example: { jp: "{大丈夫|だいじょうぶ} です か？", zh: "你還好嗎？" },
  },
  {
    jp: "{汽車|きしゃ}",
    zh: "火車（燒煤的蒸汽火車）",
    trap: "汽車、轎車",
    example: { jp: "{汽車|きしゃ} で {北海道|ほっかいどう} へ {行|い}きました。", zh: "我搭蒸汽火車去了北海道。" },
  },
  {
    jp: "{新聞|しんぶん}",
    zh: "報紙",
    trap: "新聞報導",
    example: { jp: "{朝|あさ} {新聞|しんぶん} を {読|よ}みます。", zh: "我早上看報紙。" },
  },
  {
    jp: "{床|ゆか}",
    zh: "地板",
    trap: "床鋪",
    example: { jp: "{床|ゆか} を {掃除|そうじ}します。", zh: "我要打掃地板。" },
  },
  {
    jp: "{丈夫|じょうぶ}",
    zh: "堅固、耐用；身體硬朗",
    trap: "丈夫、老公",
    example: { jp: "この かばん は {丈夫|じょうぶ} です。", zh: "這個包包很耐用。" },
  },
  {
    jp: "{娘|むすめ}",
    zh: "女兒",
    trap: "娘、母親",
    example: { jp: "{娘|むすめ} は {今年|ことし} {5歳|ごさい} です。", zh: "我女兒今年五歲。" },
  },
  {
    jp: "お{湯|ゆ}",
    zh: "熱水",
    trap: "湯（喝的）",
    example: { jp: "お{湯|ゆ} が あつい です。", zh: "熱水很燙。" },
  },
  {
    jp: "{留守|るす}",
    zh: "不在家",
    trap: "留下來看守",
    example: { jp: "{母|はは} は {今|いま} {留守|るす} です。", zh: "我媽媽現在不在家。" },
  },
  {
    jp: "{結構|けっこう}",
    zh: "不用了；相當、挺…的",
    trap: "結構、構造",
    example: { jp: "いいえ、 {結構|けっこう} です。", zh: "不用了，謝謝。" },
  },
  {
    jp: "{我慢|がまん}",
    zh: "忍耐",
    trap: "我很慢",
    example: { jp: "もう {少|すこ}し {我慢|がまん}して ください。", zh: "請再忍耐一下。" },
  },
  {
    jp: "{迷惑|めいわく}",
    zh: "困擾、添麻煩",
    trap: "迷惑、使人著迷",
    example: { jp: "ご{迷惑|めいわく} を おかけして すみません。", zh: "不好意思，給您添麻煩了。" },
  },
  {
    jp: "{怪我|けが}",
    zh: "受傷",
    trap: "怪我、怪罪我",
    example: { jp: "{足|あし} を {怪我|けが}しました。", zh: "我的腳受傷了。" },
  },
  {
    jp: "{切手|きって}",
    zh: "郵票",
    trap: "切到手",
    example: { jp: "{切手|きって} を {2枚|にまい} ください。", zh: "請給我兩張郵票。" },
  },
  {
    jp: "{走|はし}る",
    zh: "跑",
    trap: "走路",
    example: { jp: "{毎朝|まいあさ} {公園|こうえん} を {走|はし}ります。", zh: "我每天早上在公園跑步。" },
  },
  {
    jp: "{先生|せんせい}",
    zh: "老師；也用來稱呼醫生",
    trap: "先生、丈夫",
    example: { jp: "{日本語|にほんご} の {先生|せんせい} は やさしい です。", zh: "日文老師人很好。" },
  },
  {
    jp: "{階段|かいだん}",
    zh: "樓梯",
    trap: "階段、時期",
    example: { jp: "{階段|かいだん} を {上|のぼ}って ください。", zh: "請走樓梯上去。" },
  },
  {
    jp: "{人参|にんじん}",
    zh: "紅蘿蔔",
    trap: "人參",
    example: { jp: "{人参|にんじん} は {体|からだ} に いい です。", zh: "紅蘿蔔對身體很好。" },
  },
  {
    jp: "{邪魔|じゃま}",
    zh: "打擾、礙事",
    trap: "邪魔歪道",
    example: { jp: "お{邪魔|じゃま}します。", zh: "打擾了。（進別人家時說）" },
  },
];

/**
 * Characters Japan simplified after the war. The shapes differ enough that a
 * Taiwanese reader has to look twice, but the meaning is the same — so this is
 * a reading aid, not a trap list.
 */
export interface Shinjitai {
  /** The Japanese (shinjitai) form. */
  ja: string;
  /** The traditional form used in Taiwan. */
  tw: string;
  /** A common word written with it. */
  word: Example;
}

export const SHINJITAI: Shinjitai[] = [
  { ja: "駅", tw: "驛", word: { jp: "{駅|えき}", zh: "車站" } },
  { ja: "円", tw: "圓", word: { jp: "{千円|せんえん}", zh: "一千日圓" } },
  { ja: "学", tw: "學", word: { jp: "{学校|がっこう}", zh: "學校" } },
  { ja: "会", tw: "會", word: { jp: "{会社|かいしゃ}", zh: "公司" } },
  { ja: "気", tw: "氣", word: { jp: "{元気|げんき}", zh: "有精神、健康" } },
  { ja: "国", tw: "國", word: { jp: "{外国|がいこく}", zh: "外國" } },
  { ja: "来", tw: "來", word: { jp: "{来週|らいしゅう}", zh: "下禮拜" } },
  { ja: "売", tw: "賣", word: { jp: "{売店|ばいてん}", zh: "販賣部" } },
  { ja: "読", tw: "讀", word: { jp: "{読|よ}みます", zh: "讀、看（書）" } },
  { ja: "楽", tw: "樂", word: { jp: "{音楽|おんがく}", zh: "音樂" } },
  { ja: "発", tw: "發", word: { jp: "{出発|しゅっぱつ}", zh: "出發" } },
  { ja: "体", tw: "體", word: { jp: "{体|からだ}", zh: "身體" } },
  { ja: "図", tw: "圖", word: { jp: "{地図|ちず}", zh: "地圖" } },
  { ja: "写", tw: "寫", word: { jp: "{写真|しゃしん}", zh: "照片" } },
  { ja: "薬", tw: "藥", word: { jp: "{薬|くすり}", zh: "藥" } },
  { ja: "鉄", tw: "鐵", word: { jp: "{地下鉄|ちかてつ}", zh: "地下鐵" } },
  { ja: "帰", tw: "歸", word: { jp: "{帰|かえ}ります", zh: "回去" } },
  { ja: "対", tw: "對", word: { jp: "{反対|はんたい}", zh: "相反、反對" } },
  { ja: "桜", tw: "櫻", word: { jp: "{桜|さくら}", zh: "櫻花" } },
  { ja: "広", tw: "廣", word: { jp: "{広|ひろ}い", zh: "寬敞的" } },
];
