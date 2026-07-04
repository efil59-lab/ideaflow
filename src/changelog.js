// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.3";

export const CHANGELOG = [
  { icon: "edit", title: "מסך \"רעיון חדש\" מהיר", text: "לחיצה ארוכה על אייקון האפליקציה → \"רעיון\" פותחת מסך כתיבה נקי ומיידי. נגיעה אחת בכל מקום מעלה את המקלדת, ובלחיצה על שמור הרעיון נכנס ישר לאינבוקס — אפשר גם להוסיף עוד ברצף." },
];
