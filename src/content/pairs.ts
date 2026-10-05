import type { Jp } from "./types";

/**
 * Minimal pairs for listening practice: two real words that differ in exactly
 * one feature Mandarin does not use, so the learner can only tell them apart
 * by ear. Written with kanji where the word normally is — the speech engine
 * reads the plain text, and the kanji is what gives it the right pitch.
 */
export interface MinimalPair {
  a: { jp: Jp; zh: string };
  b: { jp: Jp; zh: string };
}

export interface PairCategory {
  /** Stable id; the accuracy record is kept under it. */
  id: string;
  title: string;
  /** One line on what to listen for. */
  hint: string;
  pairs: MinimalPair[];
}

export const PAIR_CATEGORIES: PairCategory[] = [
  {
    id: "long",
    title: "長音",
    hint: "多一拍就變成另一個字：おばさん（阿姨）和 おばあさん（奶奶）只差一拍。",
    pairs: [
      { a: { jp: "おばさん", zh: "阿姨" }, b: { jp: "おばあさん", zh: "奶奶" } },
      { a: { jp: "おじさん", zh: "叔叔" }, b: { jp: "おじいさん", zh: "爺爺" } },
      { a: { jp: "ビル", zh: "大樓" }, b: { jp: "ビール", zh: "啤酒" } },
      { a: { jp: "{雪|ゆき}", zh: "雪" }, b: { jp: "{勇気|ゆうき}", zh: "勇氣" } },
      { a: { jp: "{取|と}る", zh: "拿、取" }, b: { jp: "{通|とお}る", zh: "通過" } },
      { a: { jp: "そこ", zh: "那裡" }, b: { jp: "{倉庫|そうこ}", zh: "倉庫" } },
      { a: { jp: "{角|かど}", zh: "轉角" }, b: { jp: "カード", zh: "卡片" } },
      { a: { jp: "{来|き}て", zh: "過來" }, b: { jp: "{聞|き}いて", zh: "聽、問" } },
    ],
  },
  {
    id: "sokuon",
    title: "促音",
    hint: "小小的「っ」要停一拍再出聲：おと（聲音）和 おっと（老公）。",
    pairs: [
      { a: { jp: "{音|おと}", zh: "聲音" }, b: { jp: "{夫|おっと}", zh: "老公" } },
      { a: { jp: "{坂|さか}", zh: "坡道" }, b: { jp: "{作家|さっか}", zh: "作家" } },
      { a: { jp: "{肩|かた}", zh: "肩膀" }, b: { jp: "{買|か}った", zh: "買了" } },
      { a: { jp: "{猫|ねこ}", zh: "貓" }, b: { jp: "{根|ね}っこ", zh: "樹根" } },
      { a: { jp: "{先|さき}", zh: "前面、先" }, b: { jp: "さっき", zh: "剛剛" } },
      { a: { jp: "{町|まち}", zh: "城鎮" }, b: { jp: "マッチ", zh: "火柴" } },
      { a: { jp: "{部下|ぶか}", zh: "部下" }, b: { jp: "{物価|ぶっか}", zh: "物價" } },
    ],
  },
  {
    id: "voicing",
    title: "清濁音",
    hint: "か／が、た／だ 的差別華語沒有，只能靠耳朵：かき（柿子）和 かぎ（鑰匙）。",
    pairs: [
      { a: { jp: "{柿|かき}", zh: "柿子" }, b: { jp: "{鍵|かぎ}", zh: "鑰匙" } },
      { a: { jp: "{天気|てんき}", zh: "天氣" }, b: { jp: "{電気|でんき}", zh: "電燈、電" } },
      { a: { jp: "{蓋|ふた}", zh: "蓋子" }, b: { jp: "{豚|ぶた}", zh: "豬" } },
      { a: { jp: "{金|きん}", zh: "金" }, b: { jp: "{銀|ぎん}", zh: "銀" } },
      { a: { jp: "クラス", zh: "班級" }, b: { jp: "グラス", zh: "玻璃杯" } },
      { a: { jp: "{宝|たから}", zh: "寶物" }, b: { jp: "だから", zh: "所以" } },
      { a: { jp: "{猿|さる}", zh: "猴子" }, b: { jp: "ざる", zh: "竹篩" } },
      { a: { jp: "{退学|たいがく}", zh: "退學" }, b: { jp: "{大学|だいがく}", zh: "大學" } },
    ],
  },
  {
    id: "yoon",
    title: "拗音",
    hint: "きゃ 合起來只唸一拍，きや 是兩拍：びょういん（醫院）和 びよういん（美容院）。",
    pairs: [
      { a: { jp: "{病院|びょういん}", zh: "醫院" }, b: { jp: "{美容院|びよういん}", zh: "美容院" } },
      { a: { jp: "{十|じゅう}", zh: "十" }, b: { jp: "{自由|じゆう}", zh: "自由" } },
      { a: { jp: "{今日|きょう}", zh: "今天" }, b: { jp: "{器用|きよう}", zh: "手很巧" } },
      { a: { jp: "{量|りょう}", zh: "份量" }, b: { jp: "{利用|りよう}", zh: "利用、使用" } },
      { a: { jp: "{百|ひゃく}", zh: "一百" }, b: { jp: "{飛躍|ひやく}", zh: "飛躍" } },
      { a: { jp: "{客|きゃく}", zh: "客人" }, b: { jp: "{規約|きやく}", zh: "規章" } },
    ],
  },
  {
    id: "pitch",
    title: "重音",
    hint: "假名一模一樣，高低不同就是另一個字：はし（橋）和 はし（筷子）。",
    pairs: [
      { a: { jp: "{橋|はし}", zh: "橋" }, b: { jp: "{箸|はし}", zh: "筷子" } },
      { a: { jp: "{雨|あめ}", zh: "雨" }, b: { jp: "{飴|あめ}", zh: "糖果" } },
      { a: { jp: "{紙|かみ}", zh: "紙" }, b: { jp: "{神|かみ}", zh: "神" } },
      { a: { jp: "{今|いま}", zh: "現在" }, b: { jp: "{居間|いま}", zh: "客廳" } },
      { a: { jp: "{酒|さけ}", zh: "酒" }, b: { jp: "{鮭|さけ}", zh: "鮭魚" } },
      { a: { jp: "{虫|むし}", zh: "蟲" }, b: { jp: "{無視|むし}", zh: "不理會、當作沒看到" } },
      { a: { jp: "{切|き}る", zh: "切" }, b: { jp: "{着|き}る", zh: "穿" } },
      { a: { jp: "{柿|かき}", zh: "柿子" }, b: { jp: "{牡蠣|かき}", zh: "牡蠣、蚵仔" } },
    ],
  },
];
