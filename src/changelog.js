// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.4";

export const CHANGELOG = [
  { icon: "bell", title: "נודניק ישר מההתראה", text: "על התראת תזכורת יש עכשיו שני כפתורים — \"15 דק׳\" ו-\"שעה\". לחיצה דוחה את התזכורת ברקע, בלי לפתוח את האפליקציה בכלל. תפיסה על ההתראה עצמה עדיין פותחת את הרעיון." },
  { icon: "delete", title: "ריקון הפח בבת אחת", text: "בפח האשפה נוסף כפתור \"רוקן הכל\" עם אזהרה — מוחק את כל הרעיונות שבפח בפעולה אחת." },
];
