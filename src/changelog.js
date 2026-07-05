// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.10";

export const CHANGELOG = [
  { icon: "notes", title: "רעיון ללא סימון ביצוע", text: "לא כל רעיון הוא משימה. בתפריט הכרטיס (⋯) → אייקון הפתק הופך רעיון ל\"הערה\" — ריבוע הסימון נעלם והוא לא ניתן לסימון כבוצע. לחיצה נוספת מחזירה למשימה רגילה." },
];
