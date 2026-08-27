/**
 * Armenian date/time formatting utilities.
 * ICU data for Armenian may not be available in all environments,
 * so we use custom formatters as fallback.
 */

const ARMENIAN_MONTHS = [
  "Հունվար", "Փետրվար", "Մարտ", "Ապրիլ", "Մայիս", "Հունիս",
  "Հուլիս", "Օգոստոս", "Սեպտեմբեր", "Հոկտեմբեր", "Նոյեմբեր", "Դեկտեմբեր",
];

const ARMENIAN_MONTHS_SHORT = [
  "Հնվ", "Փտվ", "Մրտ", "Ապր", "Մյս", "Հնս",
  "Հլս", "Օգս", "Սպտ", "Հկտ", "Նյմ", "Դկտ",
];

const ARMENIAN_WEEKDAYS = [
  "Կիրակի", "Երկուշաբթի", "Երեքշաբթի", "Չորեքշաբթի", "Հինգշաբթի", "Ուրբաթ", "Շաբաթ",
];

const ARMENIAN_WEEKDAYS_SHORT = ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուր", "Շբթ"];

export function formatArmenianDate(date: Date, opts?: { weekday?: "long" | "short"; month?: "long" | "short"; day?: boolean; year?: boolean }): string {
  const weekday = ARMENIAN_WEEKDAYS[date.getDay()];
  const month = ARMENIAN_MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  if (opts?.weekday === "long" && opts?.month === "long") {
    return `${weekday}, ${day} ${month}`;
  }
  if (opts?.weekday === "long") {
    return `${weekday}`;
  }
  return `${day}.${String(date.getMonth() + 1).padStart(2, "0")}.${year}`;
}

export function formatArmenianDateShort(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

export function formatArmenianDateTime(date: Date): string {
  return `${formatArmenianDateShort(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatArmenianDateLong(date: Date): string {
  const weekday = ARMENIAN_WEEKDAYS[date.getDay()];
  const month = ARMENIAN_MONTHS[date.getMonth()];
  const day = date.getDate();
  return `${weekday}, ${day} ${month}`;
}
