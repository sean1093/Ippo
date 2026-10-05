import sounds from "./lessons/01-sounds";
import specialSounds from "./lessons/02-special-sounds";
import greetings from "./lessons/03-greetings";
import thanks from "./lessons/04-thanks";
import selfIntro from "./lessons/05-self-intro";
import questions from "./lessons/06-questions";
import thisThat from "./lessons/07-this-that";
import numbers from "./lessons/08-numbers";
import shopping from "./lessons/09-shopping";
import konbini from "./lessons/10-konbini";
import restaurant from "./lessons/11-restaurant";
import eating from "./lessons/12-eating";
import directions from "./lessons/13-directions";
import train from "./lessons/14-train";
import time from "./lessons/15-time";
import likes from "./lessons/16-likes";
import hotel from "./lessons/17-hotel";
import type { Lesson, Unit } from "./types";

export const COURSE: Unit[] = [
  {
    title: "發音入門",
    summary: "先把耳朵打開：五個母音、日文的節奏與特殊音。",
    lessons: [sounds, specialSounds],
  },
  {
    title: "打招呼",
    summary: "最常用的招呼語、謝謝與不好意思，再到自我介紹。",
    lessons: [greetings, thanks, selfIntro],
  },
  {
    title: "認識彼此",
    summary: "問與答、指著東西問「這是什麼」、數字。",
    lessons: [questions, thisThat, numbers],
  },
  {
    title: "購物",
    summary: "問價錢、說「請給我這個」、便利商店結帳。",
    lessons: [shopping, konbini],
  },
  {
    title: "餐廳",
    summary: "說人數、點餐、用餐禮儀與結帳。",
    lessons: [restaurant, eating],
  },
  {
    title: "交通",
    summary: "問路、搭電車、確認要去的地方。",
    lessons: [directions, train],
  },
  {
    title: "生活會話",
    summary: "時間、聊喜好，最後獨立完成飯店入住。",
    lessons: [time, likes, hotel],
  },
];

/** Every lesson in learning order. */
export const LESSONS: Lesson[] = COURSE.flatMap((unit) => unit.lessons);
