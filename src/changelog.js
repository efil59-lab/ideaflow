// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.7";

export const CHANGELOG = [
  { icon: "undo", title: "חזרה וקדימה בעריכה", text: "בעורך הרעיון נוספו כפתורי חזרה (↶) וקדימה (↷) בסרגל העיצוב — לתיקון טעות או שחזור מילה שנמחקה, בנגיעה אחת בנייד. עובד גם עם Ctrl+Z / Ctrl+Shift+Z." },
];
