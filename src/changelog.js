// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.9";

export const CHANGELOG = [
  { icon: "paste", title: "הדבקת צילום מסך", text: "צילמת מסך או העתקת תמונה? הדבק אותה ישר לרעיון עם Ctrl+V (בתיבת התפיסה או בעורך), או בכפתור \"הדבק\" בעורך. התמונה נשמרת כתמונה מצורפת." },
];
