// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.2";

export const CHANGELOG = [
  { icon: "chat", title: "נקודה אדומה לתגובה חדשה", text: "כשמגיעה תגובה שלא קראת באחד הרעיונות בפרויקט — מופיעה נקודה אדומה מהבהבת ליד שם הפרויקט. פתיחת הפרויקט מנקה אותה." },
  { icon: "bell", title: "נודניק לא מזיז את הסדרה", text: "תיקון: כשעושים \"לך לישון\" לתזכורת חוזרת, ההזזה חלה רק על הצלצול הקרוב — זמן החזרה המקורי (למשל כל יום ב-9:00) נשמר תמיד." },
  { icon: "bell", title: "אייקון מנורה בהתראה", text: "אייקון התזכורת בשורת המצב של הטלפון הוא עכשיו מנורה, במקום ריבוע לבן." },
  { icon: "edit", title: "מקלדת מוכנה מיד", text: "פתיחת \"רעיון חדש\" מקיצור האפליקציה פותחת את תיבת הכתיבה עם מקלדת פעילה — ישר להקלדה." },
];
