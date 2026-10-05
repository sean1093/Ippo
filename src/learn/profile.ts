import type { Example, Jp } from "../content/types";
import { plain } from "../lib/jp";
import { toKatakana } from "../lib/romaji";
import { asRecord, defineStore } from "../lib/store";

/**
 * What the learner says about themselves. Everything is stored the way it is
 * spoken — a katakana name and Ippo markup — so the self-introduction is built
 * by plain string joining and never needs a translation table at display time.
 */
export interface Profile {
  /** Family name in katakana, as a Japanese listener would hear it. */
  name: string;
  /** Hometown: one of `CITIES`, or free katakana for anywhere else. */
  from: Jp;
  /** One of `JOBS`. */
  job: Jp;
}

/**
 * Taiwanese places with the reading Japanese people actually use. Most
 * Taiwanese place names are read with the Japanese on'yomi of their kanji;
 * 台北 is usually タイペイ (as taught in 第 5 課), 高雄 keeps たかお and 基隆
 * キールン. Readings follow the Japanese Wikipedia entry for each city.
 */
export const CITIES: readonly Example[] = [
  { jp: "{台湾|たいわん}", zh: "台灣（不說城市）" },
  { jp: "{台北|タイペイ}", zh: "台北" },
  { jp: "{新北|しんほく}", zh: "新北" },
  { jp: "{基隆|キールン}", zh: "基隆" },
  { jp: "{桃園|とうえん}", zh: "桃園" },
  { jp: "{新竹|しんちく}", zh: "新竹" },
  { jp: "{苗栗|びょうりつ}", zh: "苗栗" },
  { jp: "{台中|たいちゅう}", zh: "台中" },
  { jp: "{彰化|しょうか}", zh: "彰化" },
  { jp: "{南投|なんとう}", zh: "南投" },
  { jp: "{雲林|うんりん}", zh: "雲林" },
  { jp: "{嘉義|かぎ}", zh: "嘉義" },
  { jp: "{台南|たいなん}", zh: "台南" },
  { jp: "{高雄|たかお}", zh: "高雄" },
  { jp: "{屏東|へいとう}", zh: "屏東" },
  { jp: "{宜蘭|ぎらん}", zh: "宜蘭" },
  { jp: "{花蓮|かれん}", zh: "花蓮" },
  { jp: "{台東|たいとう}", zh: "台東" },
  { jp: "{澎湖|ほうこ}", zh: "澎湖" },
];

/**
 * Jobs people really say about themselves. 老師 is 教師, not 先生: 先生 is
 * what you call other people, never yourself.
 */
export const JOBS: readonly Example[] = [
  { jp: "{学生|がくせい}", zh: "學生" },
  { jp: "{会社員|かいしゃいん}", zh: "上班族" },
  { jp: "エンジニア", zh: "工程師" },
  { jp: "{公務員|こうむいん}", zh: "公務員" },
  { jp: "{教師|きょうし}", zh: "老師" },
  { jp: "{看護師|かんごし}", zh: "護理師" },
  { jp: "{医者|いしゃ}", zh: "醫生" },
  { jp: "デザイナー", zh: "設計師" },
  { jp: "{店員|てんいん}", zh: "店員" },
  { jp: "{主婦|しゅふ}", zh: "家庭主婦" },
  { jp: "{主夫|しゅふ}", zh: "家庭主夫" },
  { jp: "フリーランス", zh: "自由接案" },
];

/**
 * The twenty most common Taiwanese family names. Japanese people read a
 * Chinese name either with the Japanese on'yomi of the kanji (陳 → チン) or
 * close to Mandarin (陳 → チェン); both are common, so both are offered and
 * the learner picks whichever they already answer to.
 */
export const SURNAMES: readonly { zh: string; kana: readonly string[] }[] = [
  { zh: "陳", kana: ["チン", "チェン"] },
  { zh: "林", kana: ["リン"] },
  { zh: "黃", kana: ["コウ", "ホァン"] },
  { zh: "張", kana: ["チョウ", "チャン"] },
  { zh: "李", kana: ["リ", "リー"] },
  { zh: "王", kana: ["オウ", "ワン"] },
  { zh: "吳", kana: ["ゴ", "ウー"] },
  { zh: "劉", kana: ["リュウ", "リウ"] },
  { zh: "蔡", kana: ["サイ", "ツァイ"] },
  { zh: "楊", kana: ["ヨウ", "ヤン"] },
  { zh: "許", kana: ["キョ", "シュー"] },
  { zh: "鄭", kana: ["テイ", "ジェン"] },
  { zh: "謝", kana: ["シャ", "シエ"] },
  { zh: "郭", kana: ["カク", "グオ"] },
  { zh: "洪", kana: ["コウ", "ホン"] },
  { zh: "邱", kana: ["キュウ", "チウ"] },
  { zh: "曾", kana: ["ソウ", "ツェン"] },
  { zh: "廖", kana: ["リョウ", "リャオ"] },
  { zh: "賴", kana: ["ライ"] },
  { zh: "徐", kana: ["ジョ", "シュー"] },
];

// ー is \u30fc; ヶ (\u30f6) is the last katakana `toKatakana` can produce.
const KATAKANA_NAME = /^[\u30a1-\u30f6\u30fc]+( [\u30a1-\u30f6\u30fc]+)*$/;

/**
 * `value` as a name Ippo can speak and romanise: kana only, written in
 * katakana, with the middle dot of a full name read as a word break. Returns
 * null for anything else (kanji, latin letters, an empty box).
 */
export function kanaName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = toKatakana(value.replace(/[・･\s]+/g, " ").trim());
  return KATAKANA_NAME.test(text) ? text : null;
}

/**
 * The learner's own self-introduction, line by line, in the order it is
 * spoken. Pure: the same profile always gives the same five lines, which is
 * what lets them be cards.
 */
export function selfIntro(profile: Profile): Example[] {
  // A hometown the learner typed themselves has no Chinese label of its own.
  const place = CITIES.find((city) => city.jp === profile.from)?.zh ?? plain(profile.from);
  const job = JOBS.find((option) => option.jp === profile.job)?.zh ?? plain(profile.job);
  return [
    { jp: "はじめまして。", zh: "初次見面" },
    { jp: `${profile.name} です。`, zh: `我是 ${profile.name}。` },
    { jp: `${profile.from} から {来|き}ました。`, zh: `我從${place}來。` },
    { jp: `${profile.job} です。`, zh: `我是${job}。` },
    { jp: "よろしく おねがい します。", zh: "請多指教" },
  ];
}

/**
 * A saved profile, or null when there is none to show. A half-written or
 * hand-edited profile counts as none: every line is built by joining these
 * strings, so a broken field would break the whole introduction.
 */
export function parseProfile(data: unknown): Profile | null {
  const saved = asRecord(data);
  if (!saved) return null;
  const name = kanaName(saved.name);
  const from = CITIES.some((city) => city.jp === saved.from) ? (saved.from as Jp) : kanaName(saved.from);
  const job = JOBS.some((option) => option.jp === saved.job) ? (saved.job as Jp) : null;
  return name && from && job ? { name, from, job } : null;
}

const store = defineStore("profile", 1, parseProfile);
let saved = store.load();

export function currentProfile(): Profile | null {
  return saved;
}

export function saveProfile(profile: Profile): void {
  saved = profile;
  store.save(profile);
}
