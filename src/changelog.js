// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.8";

export const CHANGELOG = [
  { icon: "refresh", title: "רענון שומר על המקום", text: "רענון של הדף כבר לא זורק אותך חזרה ל-Inbox — האפליקציה נפתחת מחדש בדיוק במסך שבו היית (פרויקט, חיפוש וכו׳)." },
];
