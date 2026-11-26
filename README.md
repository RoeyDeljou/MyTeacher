# Moon Prep

אפליקציית Web (PWA) בעברית להכנה לריאיון Unity Developer ב-Moon Active.

- **שלב Team Lead** – 100 שאלות שיחה (על עצמך, AI-first, Unity, C#, Performance, ארכיטקטורה, שרת, Native Plugins, Data, Coin Master, עבודה בצוות). עונים בעל פה עם תמלול, ומקבלים ציון, תיקונים ושאלת המשך.
- **שלב טכני ו-Live Coding** – נפתח רק אחרי לחיצה על "סיימתי". מציאת באגים, Code Review, כתיבת קוד, Live Coding עם חשיבה בקול.
- **ריאיון סופי** – נפתח אחרי השלב הטכני.
- **מילון מונחים**, **מדריך Coin Master** ו-**גיבוי התקדמות**.

## הרצה מקומית

```bash
python3 -m http.server 8000
```

ואז לפתוח `http://localhost:8000`.

## הערכת AI

- בתוך claude.ai (גרסת ה-Artifact): משוב מ-Claude בלי מפתח.
- כאתר עצמאי: מפתח Claude API בלשונית הגדרות (נשמר רק בדפדפן).
- בלי AI: הערכה בסיסית לפי נקודות מפתח.

## בניית גרסת claude.ai

```bash
python3 tools/build_artifact.py
```

יוצר את `dist/artifact.html` מאותם קבצי מקור.
