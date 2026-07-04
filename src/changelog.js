// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.1";

export const CHANGELOG = [
  { icon: "bell", title: "תזכורות חוזרות", text: "בחלון התזכורת אפשר לקבוע חזרה קבועה — כל שעה, יום, שבוע, חודש (לפי תאריך או יום בשבוע) או שנה. תזכורת חוזרת מסומנת ב-↻ על הכרטיס." },
  { icon: "bell", title: "כפתור \"לך לישון\"", text: "על כל התראת תזכורת יש כפתור דחייה: 5 דקות עד שבוע בלחיצה אחת, כמות מותאמת אישית או תאריך ושעה מדויקים." },
  { icon: "chat", title: "התראות בפרויקטים משותפים", text: "כשמישהו מוסיף רעיון או תגובה בפרויקט משותף — כל השותפים מקבלים התראה שפותחת ישר את המקום הנכון." },
  { icon: "sparkle", title: "עדכון אוטומטי", text: "האפליקציה מזהה שיצאה גרסה חדשה ומתעדכנת מעצמה — בלי התקנה מחדש ובלי רענון ידני." },
];
