// Release ritual — on every substantive change, ALWAYS:
//   1. bump APP_VERSION
//   2. describe the changes in CHANGELOG below (this exact list is what users
//      see, once, in the what's-new dialog on their next visit)
//   3. update the Guide in App.jsx if the change adds/alters a feature
export const APP_VERSION = "5.5";

export const CHANGELOG = [
  { icon: "bell", title: "נודניק מההתראה", text: "על התראת תזכורת: כפתור \"15 דק׳\" דוחה מיד ברקע, וכפתור \"אחר\" פותח את חלון הדחייה המלא — לבחירת כל זמן (שעה, יום, או זמן מותאם)." },
];
