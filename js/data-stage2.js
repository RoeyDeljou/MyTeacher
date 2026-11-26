/* שלב 2 – ריאיון טכני: Code Review, מציאת באגים, כתיבת קוד ו-Live Coding.
   k: bug | review | impl | live | explain
   code = קוד שמוצג למועמד, sol = פתרון לדוגמה (מוצג רק אחרי ניסיון), p = נקודות שהבודק מחפש.
   הערה: הפורמט המדויק של שלב זה ב-Moon Active לא ידוע. התרגילים מכסים את סוגי המבחנים הנפוצים. */
window.APP_DATA = window.APP_DATA || {};

APP_DATA.stage2Kinds = {
  bug:     { he: "מצא את הבאגים" },
  review:  { he: "Code Review" },
  impl:    { he: "כתוב מימוש" },
  live:    { he: "Live Coding עם חשיבה בקול" },
  explain: { he: "הסבר בעל פה" }
};

APP_DATA.stage2 = [
{ id:"c-update-alloc", k:"bug", lv:1, time:8, title:"Allocations בלולאה חמה",
  prompt:"הקוד רץ על 200 אויבים. מצא את כל הבעיות שקשורות לביצועים והצע תיקון.",
  code:`public class Enemy : MonoBehaviour
{
    void Update()
    {
        var player = GameObject.Find("Player");
        var renderers = GetComponentsInChildren<Renderer>();
        float dist = Vector3.Distance(transform.position, player.transform.position);
        if (dist < 5f)
        {
            foreach (var r in renderers)
                r.material.color = Color.red;
            Debug.Log("Enemy " + name + " is close: " + dist);
        }
    }
}`,
  sol:`public class Enemy : MonoBehaviour
{
    [SerializeField] private Transform player;   // מוזרק או נמצא פעם אחת
    private Renderer[] renderers;
    private MaterialPropertyBlock mpb;
    private static readonly int ColorId = Shader.PropertyToID("_Color");
    private bool isClose;
    private const float CloseDistSqr = 5f * 5f;

    void Awake()
    {
        renderers = GetComponentsInChildren<Renderer>();
        mpb = new MaterialPropertyBlock();
    }

    void Update()
    {
        bool close = (transform.position - player.position).sqrMagnitude < CloseDistSqr;
        if (close == isClose) return;           // משנים רק כשהמצב משתנה
        isClose = close;
        mpb.SetColor(ColorId, close ? Color.red : Color.white);
        foreach (var r in renderers) r.SetPropertyBlock(mpb);
    }
}`,
  p:[["GameObject.Find בכל Frame – איטי; לשמור Reference פעם אחת","find|reference|awake|cache|לשמור"],
     ["GetComponentsInChildren מקצה מערך חדש בכל Frame","getcomponentsinchildren|מערך|allocation|הקצאה"],
     ["renderer.material יוצר עותק Material לכל אויב (שובר Batching ומקצה)","material|עותק|instance|sharedmaterial|propertyblock|batching"],
     ["שרשור String ו-Debug.Log בכל Frame – הקצאות ועלות","debug.log|string|שרשור"],
     ["sqrMagnitude במקום Distance (חוסך שורש)","sqrmagnitude|שורש|sqrt"],
     ["לעדכן צבע רק כשהמצב משתנה","רק כשמשתנה|state|מצב"]],
  t:"תתחיל מהבעיה הכי יקרה (Find, Material) ותגיע לקטנות. תגיד בקול למה כל אחת יקרה." },
{ id:"c-event-leak", k:"bug", lv:2, time:8, title:"Event שלא משתחרר",
  prompt:"מסך UI שנפתח ונסגר הרבה פעמים. אחרי כמה פתיחות, המספר מתעדכן כמה פעמים ומופיעה שגיאה. מה הבאג?",
  code:`public class CoinsLabel : MonoBehaviour
{
    [SerializeField] private TMP_Text label;

    void Start()
    {
        EconomyService.Instance.OnCoinsChanged += HandleCoins;
    }

    void HandleCoins(long coins)
    {
        label.text = coins.ToString("N0");
    }
}`,
  sol:`public class CoinsLabel : MonoBehaviour
{
    [SerializeField] private TMP_Text label;

    void OnEnable()
    {
        EconomyService.Instance.OnCoinsChanged += HandleCoins;
        HandleCoins(EconomyService.Instance.Coins);   // רענון מיידי בפתיחה
    }

    void OnDisable()
    {
        if (EconomyService.Instance != null)
            EconomyService.Instance.OnCoinsChanged -= HandleCoins;
    }

    void HandleCoins(long coins) => label.text = coins.ToString("N0");
}`,
  p:[["אין -= – ה-Service ארוך-החיים מחזיק Reference למאזין שנהרס","-=|ביטול|unsubscribe|reference"],
     ["Handler על אובייקט שנהרס → MissingReferenceException","missingreference|נהרס|destroyed"],
     ["אם המסך רק מכובה ונפתח שוב עם Start – לא נרשם מחדש / נרשם כפול ב-Instantiate","start|כפול|פעמיים"],
     ["OnEnable/OnDisable כזוג סימטרי","onenable|ondisable|סימטרי"],
     ["רענון ערך נוכחי בפתיחה","רענון|ערך נוכחי|בפתיחה"]],
  t:"זו העמקה מעשית למה שלמדת על Events. תסביר את ה-Leak במשפט אחד." },
{ id:"c-async-ui", k:"bug", lv:2, time:10, title:"async שמעדכן UI שנהרס",
  prompt:"המסך נטען, שולח בקשה לשרת ומציג את התוצאה. מצא את הבעיות ותקן.",
  code:`public class ProfileScreen : MonoBehaviour
{
    [SerializeField] private TMP_Text nameLabel;

    async void Start()
    {
        var profile = await Api.GetProfileAsync();
        nameLabel.text = profile.Name;
    }
}`,
  sol:`public class ProfileScreen : MonoBehaviour
{
    [SerializeField] private TMP_Text nameLabel;
    private CancellationTokenSource cts;

    async void OnEnable()
    {
        cts = new CancellationTokenSource();
        try
        {
            var profile = await Api.GetProfileAsync(cts.Token);
            if (this == null) return;                 // נהרס בזמן ההמתנה
            nameLabel.text = profile.Name;
        }
        catch (OperationCanceledException) { }        // ביטול רגיל
        catch (Exception e) { Debug.LogException(e); ShowError(); }
    }

    void OnDisable()
    {
        cts?.Cancel();
        cts?.Dispose();
        cts = null;
    }

    void ShowError() { /* מצב שגיאה ב-UI */ }
}`,
  p:[["async void – Exceptions לא נתפסים ועלולים להיעלם או להפיל","async void|exception|נתפס"],
     ["אין ביטול – המסך עלול להיהרס לפני שהתשובה חוזרת","ביטול|cancellation|נהרס"],
     ["CancellationToken שמבוטל ב-OnDisable/OnDestroy","cancellationtoken|ondisable|ondestroy"],
     ["בדיקת this == null (Unity null) אחרי await","this == null|null|אחרי await"],
     ["טיפול בשגיאת רשת והצגת מצב שגיאה","שגיאה|error|catch|רשת"]],
  t:"זה בדיוק התרחיש שקיבלת 7/10 עליו – כאן תראה שאתה יודע לממש את התיקון." },
{ id:"c-pool-impl", k:"impl", lv:2, time:20, title:"כתוב Object Pool גנרי",
  prompt:"כתוב מחלקת Pool<T> ל-Components עם Get ו-Release, שיוצרת מראש N אובייקטים, מתרחבת כשצריך, ומאפשרת לאפס אובייקט לפני שימוש חוזר. מנע החזרה כפולה של אותו אובייקט.",
  code:`public class Pool<T> where T : Component
{
    // TODO
}`,
  sol:`public class Pool<T> where T : Component
{
    private readonly T prefab;
    private readonly Transform parent;
    private readonly Stack<T> free = new Stack<T>();
    private readonly HashSet<T> inUse = new HashSet<T>();
    private readonly Action<T> onGet;
    private readonly Action<T> onRelease;

    public Pool(T prefab, int prewarm, Transform parent = null,
                Action<T> onGet = null, Action<T> onRelease = null)
    {
        this.prefab = prefab;
        this.parent = parent;
        this.onGet = onGet;
        this.onRelease = onRelease;
        for (int i = 0; i < prewarm; i++)
            free.Push(Create());
    }

    private T Create()
    {
        T item = Object.Instantiate(prefab, parent);
        item.gameObject.SetActive(false);
        return item;
    }

    public T Get()
    {
        T item = free.Count > 0 ? free.Pop() : Create();   // מתרחב כשריק
        inUse.Add(item);
        item.gameObject.SetActive(true);
        onGet?.Invoke(item);                                 // איפוס State
        return item;
    }

    public void Release(T item)
    {
        if (!inUse.Remove(item))
        {
            Debug.LogWarning("Release on item that is not in use: " + item);
            return;                                          // מניעת החזרה כפולה
        }
        onRelease?.Invoke(item);
        item.gameObject.SetActive(false);
        free.Push(item);
    }
}`,
  p:[["where T : Component ו-Generic","where|component|generic|גנרי"],
     ["Stack/Queue לאובייקטים פנויים","stack|queue"],
     ["Prewarm בבנאי","prewarm|מראש|בנאי|constructor"],
     ["הרחבה כשהמאגר ריק","ריק|count|create|הרחבה"],
     ["Callback לאיפוס (onGet/onRelease)","onget|onrelease|איפוס|reset|action"],
     ["HashSet למניעת Release כפול","hashset|כפול|double"],
     ["SetActive true/false","setactive"]],
  t:"תכתוב קודם חתימות (API), תגיד בקול את ההחלטות, ואז תמלא. בסוף תזכיר ש-UnityEngine.Pool.ObjectPool<T> קיים." },
{ id:"c-cooldown", k:"impl", lv:1, time:12, title:"Cooldown לפי זמן שרת",
  prompt:"כתוב מחלקה שמקבלת זמן תפוגה מהשרת (UTC, ב-Unix seconds) ואת זמן השרת הנוכחי בזמן הסנכרון, ומחזירה כמה שניות נותרו בכל רגע – בלי להסתמך על השעון של המכשיר.",
  code:`public class ServerCountdown
{
    public ServerCountdown(long serverNowUnix, long expiresAtUnix) { }
    public double SecondsLeft { get; }
    public bool IsExpired { get; }
}`,
  sol:`public class ServerCountdown
{
    private readonly long expiresAtUnix;
    private readonly long serverNowAtSync;
    private readonly float realtimeAtSync;

    public ServerCountdown(long serverNowUnix, long expiresAtUnix)
    {
        this.expiresAtUnix = expiresAtUnix;
        serverNowAtSync = serverNowUnix;
        realtimeAtSync = Time.realtimeSinceStartup;   // שעון מונוטוני, לא מושפע משינוי שעה
    }

    private double ServerNow =>
        serverNowAtSync + (Time.realtimeSinceStartup - realtimeAtSync);

    public double SecondsLeft => System.Math.Max(0, expiresAtUnix - ServerNow);
    public bool IsExpired => SecondsLeft <= 0;
}`,
  p:[["לא להשתמש ב-DateTime.Now של המכשיר","datetime.now|שעון מכשיר|device clock"],
     ["לשמור את זמן השרת בעת הסנכרון","זמן שרת|sync|סנכרון"],
     ["זמן מונוטוני מקומי (realtimeSinceStartup) למדידת הזמן שעבר","realtimesincestartup|מונוטוני|monotonic"],
     ["Max(0, ...) כדי לא להחזיר ערך שלילי","max|שלילי|0"],
     ["Resync בחזרה מרקע (realtimeSinceStartup ממשיך, אבל כדאי לסנכרן שוב מול השרת)","resync|רקע|pause|focus"]],
  t:"זה מממש בקוד את מה שלמדת על Double Wins ותוקף בשרת." },
{ id:"c-balance-ordering", k:"impl", lv:3, time:20, title:"יתרה עם Version מהשרת",
  prompt:"תשובות שרת על היתרה מגיעות בסדר לא צפוי. לכל תשובה יש balance ו-version עולה. כתוב BalanceStore שמתעלם מתשובות ישנות ומפעיל אירוע רק כשהיתרה באמת משתנה.",
  code:`public class BalanceStore
{
    public event Action<long, long> OnBalanceChanged; // (oldValue, newValue)
    public long Balance { get; private set; }
    public void Apply(long balance, long version) { /* TODO */ }
}`,
  sol:`public class BalanceStore
{
    public event Action<long, long> OnBalanceChanged;
    public long Balance { get; private set; }
    private long version = -1;

    public void Apply(long balance, long newVersion)
    {
        if (newVersion <= version) return;   // תשובה ישנה או כפולה
        version = newVersion;
        if (balance == Balance) return;
        long old = Balance;
        Balance = balance;
        OnBalanceChanged?.Invoke(old, balance);
    }
}`,
  p:[["שמירת version אחרון והתעלמות מ-version קטן/שווה","version|ישן|קטן|<=|stale"],
     ["השרת הוא מקור האמת – אין חישוב יתרה בלקוח","שרת|מקור האמת|authoritative"],
     ["אירוע עם ערך ישן וחדש – מאפשר Count-Up באנימציה","old|ישן וחדש|count-up|אנימציה"],
     ["לא להפעיל אירוע כשאין שינוי","אין שינוי|=="],
     ["Thread: Apply נקרא מה-Main Thread","main thread|thread"]],
  t:"זה הפתרון בקוד לשאלת ה-Raid/רכישה/אירוע שתרגלת." },
{ id:"c-review-manager", k:"review", lv:2, time:12, title:"Code Review ל-PR של חבר צוות",
  prompt:"חבר צוות פתח PR. כתוב הערות Review כאילו אתה עושה Review אמיתי: מה חייב לתקן, מה כדאי, ומה בסדר. נסח בטון מקצועי.",
  code:`public class RewardManager : MonoBehaviour
{
    public static RewardManager instance;
    public int coins;
    public Text coinsText;
    public AudioSource audio;

    void Awake() { instance = this; }

    public void GiveReward(int amount)
    {
        coins += amount;
        PlayerPrefs.SetInt("coins", coins);
        coinsText.text = "Coins: " + coins;
        audio.Play();
        StartCoroutine(SendToServer(amount));
    }

    IEnumerator SendToServer(int amount)
    {
        var req = UnityWebRequest.Get("https://api.game.com/add?amount=" + amount);
        yield return req.SendWebRequest();
    }
}`,
  sol:`הערות חוסמות (חייב):
1. הלקוח קובע את היתרה ושולח "add amount" – כל שחקן יכול לרמות. השרת צריך להחליט על התגמול ולהחזיר יתרה.
2. PlayerPrefs כמקור אמת למטבעות – ניתן לעריכה ונעלם בהחלפת מכשיר.
3. GET לפעולה שמשנה נתונים ובלי Idempotency – Retry עלול להעניק פעמיים.
4. אין טיפול בשגיאת רשת, ו-UnityWebRequest לא משוחרר (using / Dispose).

הערות חשובות:
5. מחלקה אחת עושה Economy, UI, Audio, Persistence ו-Network – לפצל ולתקשר דרך Events.
6. Singleton ציבורי שנדרס בכל Awake (אין הגנה מכפילות) ושדות public שבירים – [SerializeField] private.
7. הטקסט מתעדכן לפני אישור השרת.

קטנות:
8. שרשור String; שם השדה audio מסתיר את Component.audio הישן; Text הישן מול TMP.

מה טוב: הפעולה מרוכזת במקום אחד וקל להבין את ה-Flow.`,
  p:[["Server Authority – הלקוח לא קובע סכום","שרת|authoritative|לרמות|cheat|לקוח קובע"],
     ["PlayerPrefs כמקור אמת","playerprefs"],
     ["GET לשינוי נתונים, בלי Idempotency/Retry","get|post|idempotency|retry"],
     ["אין טיפול בשגיאות ו-Dispose","שגיאה|error|dispose|using"],
     ["SRP – יותר מדי אחריות","srp|אחריות|לפצל|events"],
     ["Singleton / public fields","singleton|public|serializefield"],
     ["טון מקצועי וגם מה טוב","טוב|חיובי|טון"]],
  t:"בריאיון Review תתחיל מהחמור (אבטחה/כלכלה), תגיד גם מה טוב, ותנסח כהצעה ולא כהאשמה." },
{ id:"c-dict-bug", k:"bug", lv:1, time:6, title:"שינוי אוסף בזמן מעבר",
  prompt:"הקוד זורק Exception לפעמים. למה, ואיך מתקנים?",
  code:`Dictionary<int, Enemy> enemies = new Dictionary<int, Enemy>();

void RemoveDead()
{
    foreach (var pair in enemies)
    {
        if (pair.Value.IsDead)
            enemies.Remove(pair.Key);
    }
}`,
  sol:`private readonly List<int> toRemove = new List<int>();

void RemoveDead()
{
    toRemove.Clear();
    foreach (var pair in enemies)
        if (pair.Value.IsDead) toRemove.Add(pair.Key);

    foreach (int id in toRemove)
        enemies.Remove(id);
}`,
  p:[["אסור לשנות אוסף בזמן foreach – InvalidOperationException","invalidoperation|foreach|לשנות|collection was modified"],
     ["לאסוף מפתחות להסרה ולהסיר אחרי","לאסוף|אחרי|toremove"],
     ["List להסרה שמוקצית פעם אחת (Clear) – בלי Allocation כל קריאה","clear|פעם אחת|allocation"],
     ["חלופה: לולאה הפוכה על List","הפוך|reverse|for"]],
  t:"" },
{ id:"c-coroutine-double", k:"bug", lv:1, time:6, title:"Coroutine כפולה",
  prompt:"כפתור 'אסוף' מפעיל אנימציה. כשלוחצים מהר פעמיים, היתרה בתצוגה מגיעה לערך שגוי. למה?",
  code:`public void OnCollectClicked()
{
    StartCoroutine(CountUp(displayed, target, 1f));
}

IEnumerator CountUp(long from, long to, float duration)
{
    float t = 0;
    while (t < duration)
    {
        t += Time.deltaTime;
        displayed = (long)Mathf.Lerp(from, to, t / duration);
        label.text = displayed.ToString();
        yield return null;
    }
}`,
  sol:`private Coroutine countRoutine;

public void ShowBalance(long target)
{
    if (countRoutine != null) StopCoroutine(countRoutine);
    countRoutine = StartCoroutine(CountUp(displayed, target, 1f));
}

IEnumerator CountUp(long from, long to, float duration)
{
    float t = 0;
    while (t < duration)
    {
        t += Time.deltaTime;
        displayed = (long)Mathf.Lerp(from, to, Mathf.Clamp01(t / duration));
        label.text = displayed.ToString();
        yield return null;
    }
    displayed = to;                       // מבטיח ערך סופי מדויק
    label.text = displayed.ToString();
    countRoutine = null;
}`,
  p:[["שתי Coroutines רצות במקביל וכותבות לאותו displayed","במקביל|שתיים|כפול"],
     ["לשמור Reference ולעצור את הקודמת (Cancel/Replace)","stopcoroutine|reference|replace|לעצור"],
     ["לקבוע ערך סופי מדויק בסוף","ערך סופי|to|בסוף"],
     ["Mathf.Lerp עם float מאבד דיוק במספרים גדולים מאוד (long)","דיוק|float|precision|long"],
     ["חסימת לחיצה כפולה ב-UI","לחיצה כפולה|interactable|disable"]],
  t:"זה מממש את ה-Cancel/Replace Strategy שהוזכר במשוב שלך." },
{ id:"c-hashset", k:"impl", lv:1, time:10, title:"מעקב אחרי מטבעות פעילים",
  prompt:"כתוב ActiveCoinsTracker שמחזיק את המטבעות הפעילים, מתעדכן כשמטבע מופעל או חוזר ל-Pool, ומאפשר לעבור עליהם ב-Update בלי Allocations.",
  code:`public class ActiveCoinsTracker : MonoBehaviour
{
    // TODO
}`,
  sol:`public class ActiveCoinsTracker : MonoBehaviour
{
    private readonly List<Coin> active = new List<Coin>(64);
    private readonly Dictionary<Coin, int> index = new Dictionary<Coin, int>(64);

    public void Add(Coin c)
    {
        if (index.ContainsKey(c)) return;
        index[c] = active.Count;
        active.Add(c);
    }

    public void Remove(Coin c)                 // O(1): Swap with last
    {
        if (!index.TryGetValue(c, out int i)) return;
        int last = active.Count - 1;
        Coin moved = active[last];
        active[i] = moved;
        index[moved] = i;
        active.RemoveAt(last);
        index.Remove(c);
    }

    void Update()
    {
        for (int i = 0; i < active.Count; i++)   // for על List – בלי Allocation
            active[i].Tick(Time.deltaTime);
    }
}`,
  p:[["רשימה פעילה שמתעדכנת באירועים ולא סריקה של כולם","אירועים|event|רשימה פעילה|active"],
     ["Capacity מראש","capacity|מראש"],
     ["הסרה ב-O(1) (Swap with last) או HashSet","o(1)|swap|hashset"],
     ["for על List בלי Allocation","for|allocation"],
     ["מניעת הוספה כפולה","כפול|contains"]],
  t:"זה ההמשך הישיר של תרגיל ה-List ב-Update שקיבלת עליו 9/10." },
{ id:"c-linq-review", k:"review", lv:1, time:6, title:"LINQ ב-Update",
  prompt:"מה הבעיה בקוד, ומתי הוא דווקא בסדר?",
  code:`void Update()
{
    var target = enemies
        .Where(e => e.IsAlive)
        .OrderBy(e => Vector3.Distance(e.transform.position, transform.position))
        .FirstOrDefault();
    if (target != null) Aim(target);
}`,
  sol:`void Update()
{
    Enemy best = null;
    float bestSqr = float.MaxValue;
    Vector3 p = transform.position;
    for (int i = 0; i < enemies.Count; i++)
    {
        var e = enemies[i];
        if (!e.IsAlive) continue;
        float d = (e.transform.position - p).sqrMagnitude;
        if (d < bestSqr) { bestSqr = d; best = e; }
    }
    if (best != null) Aim(best);
}`,
  p:[["Allocations: Enumerators ו-Closures בכל Frame","allocation|enumerator|closure|gc"],
     ["OrderBy ממיין הכול O(n log n) כשצריך רק מינימום O(n)","orderby|מיון|n log n|o(n)|מינימום"],
     ["sqrMagnitude במקום Distance","sqrmagnitude"],
     ["LINQ בסדר בקוד שלא רץ כל Frame","בסדר|לא כל frame|טעינה"]],
  t:"" },
{ id:"c-sm", k:"impl", lv:2, time:20, title:"State Machine למכונת Spin",
  prompt:"כתוב State Machine פשוטה למכונת Spin עם המצבים Idle, Spinning, WaitingForServer, ShowingResult. Spin מותר רק מ-Idle. התוצאה מגיעה מהשרת. האנימציה מינימלית של שנייה גם אם השרת מהיר.",
  code:`public enum SpinState { Idle, Spinning, WaitingForServer, ShowingResult }

public class SpinMachine : MonoBehaviour
{
    // TODO
}`,
  sol:`public class SpinMachine : MonoBehaviour
{
    public event Action<SpinState> OnStateChanged;
    public SpinState State { get; private set; } = SpinState.Idle;
    [SerializeField] private float minSpinSeconds = 1f;

    private void SetState(SpinState s) { State = s; OnStateChanged?.Invoke(s); }

    public void RequestSpin()
    {
        if (State != SpinState.Idle) return;          // חסימת לחיצה כפולה
        StartCoroutine(SpinFlow());
    }

    private IEnumerator SpinFlow()
    {
        SetState(SpinState.Spinning);
        float started = Time.time;
        SpinResult result = null;
        bool failed = false;
        Api.Spin(r => result = r, _ => failed = true); // callback ב-Main Thread

        yield return new WaitUntil(() => Time.time - started >= minSpinSeconds);
        if (result == null && !failed) SetState(SpinState.WaitingForServer);
        yield return new WaitUntil(() => result != null || failed);

        if (failed) { SetState(SpinState.Idle); ShowError(); yield break; }

        SetState(SpinState.ShowingResult);
        yield return ShowResult(result);               // אנימציה בלבד, היתרה כבר מהשרת
        SetState(SpinState.Idle);
    }

    private IEnumerator ShowResult(SpinResult r) { yield return null; }
    private void ShowError() { }
}`,
  p:[["Enum / States מפורשים ומעבר דרך פונקציה אחת","enum|setstate|state"],
     ["חסימת Spin שלא מ-Idle","idle|חסימה|return"],
     ["זמן מינימלי לאנימציה במקביל לבקשה","מינימלי|במקביל|waituntil"],
     ["התוצאה מהשרת; האנימציה מציגה","שרת|result|מציגה"],
     ["טיפול בכישלון וחזרה ל-Idle","failed|שגיאה|error"],
     ["Event על שינוי State ל-UI/Audio","event|onstatechanged"]],
  t:"תדבר על ההחלטות: למה Enum ולא Booleans, מה קורה בכישלון, ומי מקור האמת." },
{ id:"c-string-alloc", k:"explain", lv:1, time:5, title:"כמה Allocations יש כאן?",
  prompt:"הסבר בעל פה אילו שורות מקצות זיכרון על ה-Heap ולמה.",
  code:`void Update()
{
    int score = GetScore();
    object boxed = score;                       // 1
    string s = "Score: " + score;               // 2
    var list = new List<int>();                 // 3
    Vector3 v = new Vector3(1, 2, 3);           // 4
    Action a = () => Debug.Log(score);          // 5
    int[] arr = new int[10];                    // 6
}`,
  sol:`1. כן – Boxing של int ל-object.
2. כן – String חדש (ובגרסאות מסוימות גם Boxing של score).
3. כן – אובייקט List על ה-Heap.
4. לא – Vector3 הוא struct, משתנה מקומי ללא Heap Allocation.
5. כן – Lambda שתופסת משתנה מקומי יוצרת Closure ו-Delegate.
6. כן – מערך הוא Reference Type.`,
  p:[["Boxing ל-object","boxing|object"],
     ["String חדש","string"],
     ["new List מקצה","list"],
     ["Vector3 struct – לא מקצה","vector3|struct|לא מקצה"],
     ["Closure של Lambda","closure|lambda|delegate"],
     ["מערך מקצה","מערך|array"]],
  t:"" },
{ id:"c-singleton", k:"review", lv:2, time:8, title:"Singleton בטוח",
  prompt:"מה הבעיות במימוש? כתוב גרסה טובה יותר ותגיד מתי בכלל לא היית משתמש ב-Singleton.",
  code:`public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance;
    void Awake()
    {
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }
}`,
  sol:`public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);            // מונע כפילות בטעינת Scene חוזרת
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }
}
// חלופה: הזרקת תלות (Inspector/DI) – קל יותר לבדיקות ופחות Coupling.`,
  p:[["אין הגנה מכפילות כשהסצנה נטענת שוב","כפילות|duplicate|destroy"],
     ["Setter ציבורי – כל אחד יכול לדרוס","private set|setter|לדרוס"],
     ["ניקוי ב-OnDestroy","ondestroy|null"],
     ["חסרונות: State גלובלי, Coupling, קושי בבדיקות; חלופה DI","coupling|di|בדיקות|גלובלי"]],
  t:"" },
{ id:"c-live-inventory", k:"live", lv:2, time:35, title:"Live Coding: Inventory",
  prompt:"Live Coding (35 דקות). ממש Inventory למשחק: הוספת פריט עם כמות, הסרה, בדיקה אם יש מספיק, ומגבלת גודל ערימה (Stack) לכל סוג פריט. תחשוב בקול, תשאל שאלות הבהרה, ותכתוב בדיקות לשני מקרים לפחות.",
  code:`public class ItemDef { public string Id; public int MaxStack; }

public class Inventory
{
    public bool TryAdd(ItemDef item, int amount) { throw new NotImplementedException(); }
    public bool TryRemove(string itemId, int amount) { throw new NotImplementedException(); }
    public int Count(string itemId) { throw new NotImplementedException(); }
}`,
  sol:`public class Inventory
{
    private readonly Dictionary<string, int> counts = new Dictionary<string, int>();
    private readonly Dictionary<string, ItemDef> defs = new Dictionary<string, ItemDef>();
    public event Action<string, int> OnChanged;

    public int Count(string itemId) => counts.TryGetValue(itemId, out int c) ? c : 0;

    public bool TryAdd(ItemDef item, int amount)
    {
        if (item == null || amount <= 0) return false;
        int current = Count(item.Id);
        if (current + amount > item.MaxStack) return false;   // החלטה: לא מוסיפים חלקית
        defs[item.Id] = item;
        counts[item.Id] = current + amount;
        OnChanged?.Invoke(item.Id, counts[item.Id]);
        return true;
    }

    public bool TryRemove(string itemId, int amount)
    {
        if (amount <= 0) return false;
        int current = Count(itemId);
        if (current < amount) return false;
        int left = current - amount;
        if (left == 0) counts.Remove(itemId); else counts[itemId] = left;
        OnChanged?.Invoke(itemId, left);
        return true;
    }
}

// בדיקות (NUnit):
// [Test] public void Add_OverMaxStack_Fails() { ... Assert.IsFalse(inv.TryAdd(def /*Max=5*/, 6)); }
// [Test] public void Remove_MoreThanOwned_Fails_AndKeepsCount() { ... }`,
  p:[["שאלות הבהרה: הוספה חלקית? כמה סלוטים? מקור האמת בשרת?","שאלות|הבהרה|חלקית|שרת"],
     ["Dictionary לפי Id – O(1)","dictionary|id|o(1)"],
     ["ולידציה: amount<=0, null","ולידציה|<= 0|null"],
     ["אכיפת MaxStack","maxstack|מגבלה"],
     ["הסרה כשמגיעים ל-0","0|remove"],
     ["Event לשינויים ל-UI","event|onchanged"],
     ["בדיקות Unit לשני מקרים","test|assert|nunit|בדיקה"]],
  t:"ב-Live Coding מה שנבדק הוא תהליך: שאלות, תכנון קצר, קוד נקי, בדיקות, והסבר. לא להיתקע בשקט." },
{ id:"c-live-loader", k:"live", lv:3, time:40, title:"Live Coding: טוען תמונות עם Cache",
  prompt:"Live Coding (40 דקות). ממש ImageLoader שטוען Texture מ-URL, מחזיק Cache בזיכרון עם מגבלת כמות (LRU), לא מוריד פעמיים אותו URL כשיש שתי בקשות במקביל, ומאפשר ביטול.",
  code:`public class ImageLoader
{
    public Task<Texture2D> LoadAsync(string url, CancellationToken ct) { throw new NotImplementedException(); }
}`,
  sol:`public class ImageLoader
{
    private readonly int capacity;
    private readonly Dictionary<string, LinkedListNode<(string url, Texture2D tex)>> map = new();
    private readonly LinkedList<(string url, Texture2D tex)> lru = new();
    private readonly Dictionary<string, Task<Texture2D>> inFlight = new();

    public ImageLoader(int capacity) { this.capacity = capacity; }

    public async Task<Texture2D> LoadAsync(string url, CancellationToken ct)
    {
        if (map.TryGetValue(url, out var node))
        {
            lru.Remove(node); lru.AddFirst(node);          // עדכון LRU
            return node.Value.tex;
        }
        if (!inFlight.TryGetValue(url, out var task))
        {
            task = Download(url);                           // מניעת הורדה כפולה
            inFlight[url] = task;
        }
        try
        {
            var tex = await task;
            ct.ThrowIfCancellationRequested();             // הקורא ביטל – ההורדה נשמרת ל-Cache
            return tex;
        }
        finally { inFlight.Remove(url); }
    }

    private async Task<Texture2D> Download(string url)
    {
        using var req = UnityWebRequestTexture.GetTexture(url);
        var op = req.SendWebRequest();
        while (!op.isDone) await Task.Yield();
        if (req.result != UnityWebRequest.Result.Success) throw new Exception(req.error);
        var tex = DownloadHandlerTexture.GetContent(req);
        Put(url, tex);
        return tex;
    }

    private void Put(string url, Texture2D tex)
    {
        if (map.ContainsKey(url)) return;
        var node = lru.AddFirst((url, tex));
        map[url] = node;
        if (map.Count > capacity)
        {
            var last = lru.Last;
            lru.RemoveLast();
            map.Remove(last.Value.url);
            Object.Destroy(last.Value.tex);                 // שחרור זיכרון Native
        }
    }
}`,
  p:[["Cache: Dictionary + LinkedList ל-LRU","lru|linkedlist|dictionary|cache"],
     ["מניעת בקשות כפולות – Task משותף ב-inFlight","inflight|כפול|task משותף|במקביל"],
     ["ביטול עם CancellationToken","cancellationtoken|ביטול"],
     ["UnityWebRequestTexture ו-using/Dispose","unitywebrequest|using|dispose"],
     ["Destroy ל-Texture שיוצאת מה-Cache","destroy|texture|native|שחרור"],
     ["טיפול בשגיאות","error|שגיאה|exception"],
     ["Main Thread – Unity APIs","main thread"]],
  t:"אם אין זמן לכל הסעיפים – תגיד במפורש מה ויתרת ואיך היית משלים. זה נחשב לטובתך." },
{ id:"c-live-leaderboard", k:"live", lv:2, time:30, title:"Live Coding: Top K",
  prompt:"Live Coding (30 דקות). כתוב פונקציה שמקבלת רשימת תוצאות של שחקנים (id, score) ו-K, ומחזירה את K התוצאות הגבוהות בסדר יורד. נתח סיבוכיות. ואז: מה משתנה אם הרשימה מגיעה כ-Stream של מיליוני רשומות?",
  code:`public struct Entry { public string Id; public int Score; }

public static List<Entry> TopK(IReadOnlyList<Entry> all, int k)
{
    throw new NotImplementedException();
}`,
  sol:`public static List<Entry> TopK(IReadOnlyList<Entry> all, int k)
{
    if (k <= 0) return new List<Entry>();
    // Min-Heap בגודל k: O(n log k) זמן, O(k) זיכרון
    var heap = new PriorityQueue<Entry, int>();      // .NET 6+; ב-Unity ייתכן שצריך מימוש עצמי
    foreach (var e in all)
    {
        if (heap.Count < k) heap.Enqueue(e, e.Score);
        else if (heap.TryPeek(out _, out int min) && e.Score > min)
        {
            heap.Dequeue();
            heap.Enqueue(e, e.Score);
        }
    }
    var result = new List<Entry>(heap.Count);
    while (heap.Count > 0) result.Add(heap.Dequeue());
    result.Reverse();                                 // סדר יורד
    return result;
}
// חלופה פשוטה: מיון מלא O(n log n) – בסדר ל-n קטן.
// Stream: אותו Min-Heap עובד כי הוא לא צריך את כל הנתונים בזיכרון.`,
  p:[["פתרון פשוט קודם: מיון O(n log n)","מיון|sort|n log n"],
     ["שיפור: Min-Heap בגודל K – O(n log k)","heap|ערימה|n log k|priorityqueue"],
     ["מקרי קצה: k<=0, k>n, ציונים שווים","k<=0|k>n|שווים|edge"],
     ["Stream: Heap לא דורש את כל הנתונים בזיכרון","stream|זיכרון"],
     ["הערה: זמינות PriorityQueue תלויה בגרסת .NET של Unity","priorityqueue|.net|גרסה"]],
  t:"תתחיל מהפתרון הפשוט, תגיד את הסיבוכיות, ורק אז תשפר. זה מה שמראיינים אוהבים לראות." },
{ id:"c-ai-diff", k:"review", lv:2, time:10, title:"Review לקוד שנוצר ב-AI",
  prompt:"Claude Code יצר את המתודה הזו כדי 'לשמור את השחקן'. עבור עליה כמו Reviewer: מה תבדוק, מה תתקן, ומה תשאל את ה-AI.",
  code:`public async void SavePlayer(Player p)
{
    string json = JsonUtility.ToJson(p);
    File.WriteAllText(Application.dataPath + "/save.json", json);
    await Task.Delay(100);
    Debug.Log("Saved!");
}`,
  sol:`1. Application.dataPath לא כתיב במובייל – להשתמש ב-Application.persistentDataPath ו-Path.Combine.
2. async void בלי סיבה – Task.Delay מיותר ואין טיפול ב-Exceptions.
3. כתיבה ישירה עלולה להשאיר קובץ פגום אם האפליקציה נהרגת באמצע – לכתוב לקובץ זמני ואז להחליף (Atomic write).
4. JsonUtility לא מסרלז Dictionary/Properties – לוודא שהמבנה נתמך.
5. אם זה נתוני כלכלה – לא מקור אמת בלקוח.
6. כתיבה סינכרונית ב-Main Thread עלולה לגרום Hitch בקובץ גדול.
שאלה ל-AI: למה הוספת Task.Delay? – זה סימן לקוד שנוסף בלי סיבה.`,
  p:[["persistentDataPath ולא dataPath","persistentdatapath|datapath"],
     ["async void ו-Task.Delay מיותר","async void|task.delay|מיותר"],
     ["כתיבה אטומית / קובץ זמני","אטומי|atomic|זמני|temp"],
     ["מגבלות JsonUtility","jsonutility|dictionary"],
     ["טיפול בשגיאות","exception|try|שגיאה"],
     ["לא לקבל קוד בלי להבין כל שורה","להבין|כל שורה|לשאול"]],
  t:"מתאים במיוחד למשרה AI-first: להראות שאתה Reviewer קפדני לקוד של AI." },
{ id:"c-explain-gc", k:"explain", lv:2, time:5, title:"הסבר בעל פה: GC ב-Unity",
  prompt:"הסבר בדקה וחצי למפתח ג'וניור: מה זה Garbage Collector, למה הוא גורם לקפיצות במשחק, ומה שלושת הכללים שלך כדי להימנע ממנו.",
  code:"",
  sol:`GC אוסף אובייקטים על ה-Heap שאין אליהם יותר References. בזמן איסוף, העבודה לוקחת זמן ב-Main Thread ולכן יכולה ליצור Frame ארוך (Spike). Incremental GC מפזר את העבודה על כמה Frames אבל לא מבטל אותה.
שלושה כללים: (1) לא להקצות בנתיב חם – Update, לולאות, UI שמתעדכן כל Frame. (2) לשמור ולמחזר: Cache ל-References, Pooling, רשימות שמוקצות פעם אחת עם Clear. (3) למדוד עם עמודת GC Alloc ב-Profiler לפני ואחרי.`,
  p:[["GC אוסף אובייקטים בלי References על ה-Heap","heap|references|אוסף"],
     ["עבודה ב-Main Thread → Spike","main thread|spike|קפיצה|frame"],
     ["Incremental GC מפזר","incremental"],
     ["לא להקצות בנתיב חם","update|נתיב חם|לולאה"],
     ["Cache ו-Pooling","cache|pool"],
     ["למדוד ב-Profiler","profiler|gc alloc"]],
  t:"הסבר לג'וניור בודק אם אתה באמת מבין – בלי מונחים מיותרים." },
{ id:"c-explain-addr", k:"explain", lv:3, time:5, title:"הסבר בעל פה: Addressables Lifecycle",
  prompt:"הסבר את מחזור החיים של Asset שנטען עם Addressables: טעינה, Reference Counting, שחרור, ומה קורה ל-Bundle.",
  code:"",
  sol:`LoadAssetAsync מחזיר AsyncOperationHandle ומעלה Reference Count על ה-Asset ועל ה-Bundle שמכיל אותו (ועל Bundles שהוא תלוי בהם). כל Load צריך Release מתאים. כשה-Count של Bundle מגיע ל-0, הוא נפרק מהזיכרון. אם Asset אחד מה-Bundle עדיין בשימוש – כל ה-Bundle נשאר. InstantiateAsync משתחרר עם ReleaseInstance (או Release על האובייקט). Event Viewer / Profiler module של Addressables עוזר לראות מה עדיין טעון.`,
  p:[["Handle ו-Reference Count","handle|reference count|ספירה"],
     ["Load ו-Release בזוגות","release|זוג|כל load"],
     ["Bundle נפרק כש-Count מגיע ל-0","bundle|0|נפרק"],
     ["Asset אחד בשימוש מחזיק את כל ה-Bundle","כל ה-bundle|מחזיק"],
     ["InstantiateAsync ↔ ReleaseInstance","instantiateasync|releaseinstance"],
     ["כלי ניטור (Event Viewer / Profiler)","event viewer|profiler"]],
  t:"זה בדיוק אחד הפערים שסימנו לך – שווה לתרגל עד שזה זורם." },
{ id:"c-ui-pool", k:"impl", lv:2, time:20, title:"רשימה ממוחזרת לחנות",
  prompt:"כתוב את הליבה של רשימת UI ממוחזרת: יש 200 פריטים, רק 8 כרטיסים נראים. בגלילה, הכרטיסים מתמחזרים ומקבלים נתונים חדשים. התמקד בלוגיקת המיפוי בין Scroll Position לאינדקסים – לא בעיצוב.",
  code:`public class RecycledList : MonoBehaviour
{
    [SerializeField] private RectTransform content;
    [SerializeField] private ItemCard cardPrefab;
    [SerializeField] private float itemHeight = 120f;
    private IReadOnlyList<ItemData> data;
    // TODO
}`,
  sol:`public class RecycledList : MonoBehaviour
{
    [SerializeField] private ScrollRect scroll;
    [SerializeField] private RectTransform content;
    [SerializeField] private ItemCard cardPrefab;
    [SerializeField] private float itemHeight = 120f;
    [SerializeField] private int visibleCount = 8;
    private readonly List<ItemCard> cards = new List<ItemCard>();
    private IReadOnlyList<ItemData> data;
    private int firstIndex = -1;

    public void SetData(IReadOnlyList<ItemData> items)
    {
        data = items;
        content.sizeDelta = new Vector2(content.sizeDelta.x, items.Count * itemHeight);
        int needed = Mathf.Min(visibleCount + 2, items.Count);   // באפר קטן
        while (cards.Count < needed) cards.Add(Instantiate(cardPrefab, content));
        firstIndex = -1;
        Refresh();
    }

    void OnEnable()  => scroll.onValueChanged.AddListener(OnScroll);
    void OnDisable() => scroll.onValueChanged.RemoveListener(OnScroll);
    void OnScroll(Vector2 _) => Refresh();

    void Refresh()
    {
        int first = Mathf.Clamp(Mathf.FloorToInt(content.anchoredPosition.y / itemHeight),
                                0, Mathf.Max(0, data.Count - cards.Count));
        if (first == firstIndex) return;                      // אין שינוי – לא נוגעים ב-UI
        firstIndex = first;
        for (int i = 0; i < cards.Count; i++)
        {
            int dataIndex = first + i;
            var rt = (RectTransform)cards[i].transform;
            rt.anchoredPosition = new Vector2(0, -dataIndex * itemHeight);
            cards[i].Bind(data[dataIndex]);   // Bind מבטל טעינת תמונה קודמת ובודק רלוונטיות
        }
    }
}`,
  p:[["מספר קבוע של כרטיסים + באפר","קבוע|באפר|buffer|visible"],
     ["חישוב firstIndex מ-Scroll Position","firstindex|scroll|position|floor"],
     ["Bind של נתונים לכרטיס","bind|נתונים"],
     ["לא לעשות כלום אם האינדקס לא השתנה","לא השתנה|return"],
     ["ביטול טעינת תמונה קודמת בכרטיס שמתמחזר","ביטול|תמונה|רלוונטי"],
     ["לא Layout Group על Content ממוחזר","layout group"]],
  t:"זו ההמשך המעשי של תרגיל 200 הפריטים שלך." },
{ id:"c-test-economy", k:"impl", lv:2, time:15, title:"כתוב בדיקות ל-Economy",
  prompt:"נתונה מחלקה Wallet עם TrySpend(long amount) ו-Add(long amount). כתוב 4 בדיקות NUnit משמעותיות. תסביר למה בחרת דווקא בהן.",
  code:`public class Wallet
{
    public long Coins { get; private set; }
    public void Add(long amount) { if (amount < 0) throw new ArgumentException(); Coins += amount; }
    public bool TrySpend(long amount)
    {
        if (amount <= 0 || amount > Coins) return false;
        Coins -= amount;
        return true;
    }
}`,
  sol:`[TestFixture]
public class WalletTests
{
    [Test] public void Spend_MoreThanBalance_ReturnsFalse_AndKeepsBalance()
    {
        var w = new Wallet(); w.Add(100);
        Assert.IsFalse(w.TrySpend(101));
        Assert.AreEqual(100, w.Coins);
    }

    [Test] public void Spend_ExactBalance_LeavesZero()
    {
        var w = new Wallet(); w.Add(50);
        Assert.IsTrue(w.TrySpend(50));
        Assert.AreEqual(0, w.Coins);
    }

    [TestCase(0)] [TestCase(-5)]
    public void Spend_NonPositive_ReturnsFalse(long amount)
    {
        var w = new Wallet(); w.Add(10);
        Assert.IsFalse(w.TrySpend(amount));
        Assert.AreEqual(10, w.Coins);
    }

    [Test] public void Add_Negative_Throws()
    {
        Assert.Throws<ArgumentException>(() => new Wallet().Add(-1));
    }
}`,
  p:[["גבולות: יותר מהיתרה, בדיוק היתרה","גבול|boundary|בדיוק|יותר"],
     ["ערכים לא חוקיים: 0 ושלילי","0|שלילי|negative"],
     ["בדיקה שה-State לא השתנה בכישלון","לא השתנה|נשאר|state"],
     ["Assert.Throws ל-Exception","throws|exception"],
     ["TestCase לכמה ערכים","testcase"],
     ["שמות בדיקות שמתארים התנהגות","שם|naming|מתאר"]],
  t:"" },
{ id:"c-native-bridge", k:"explain", lv:3, time:6, title:"הסבר בעל פה: גשר ל-Native",
  prompt:"הסבר איך היית קורא מ-C# לפונקציה Native ב-Android שמחזירה את רמת הסוללה, ואיך מקבלים Callback חזרה. אם לא עבדת עם זה בפועל – תגיד ותסביר איך היית ניגש.",
  code:`// Android (Java)
public class BatteryPlugin {
    public static int getBatteryLevel(Context ctx) { ... }
}`,
  sol:`ב-Android:
using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
using var plugin = new AndroidJavaClass("com.company.BatteryPlugin");
int level = plugin.CallStatic<int>("getBatteryLevel", activity);
ל-Callback: AndroidJavaProxy שמממש Interface של Java, או UnitySendMessage לשם GameObject ומתודה. Callbacks יכולים להגיע מ-Thread אחר, ולכן מעבירים ל-Main Thread לפני נגיעה ב-Unity API. לעטוף בתוך #if UNITY_ANDROID && !UNITY_EDITOR ולספק Mock ב-Editor.`,
  p:[["AndroidJavaClass / AndroidJavaObject","androidjavaclass|androidjavaobject"],
     ["currentActivity כ-Context","currentactivity|context|activity"],
     ["CallStatic<T>","callstatic"],
     ["Callback: AndroidJavaProxy / UnitySendMessage","androidjavaproxy|unitysendmessage|callback"],
     ["Thread אחר → Main Thread","thread|main thread"],
     ["#if UNITY_ANDROID ו-Mock ב-Editor","#if|unity_android|mock|editor"],
     ["Dispose / using","dispose|using"]],
  t:"כנות + עיקרון נכון > המצאה. זה מה שמראיין מנוסה יעריך." },
{ id:"c-race", k:"bug", lv:3, time:10, title:"Race Condition בטעינה",
  prompt:"המשתמש לוחץ מהר על שלושה טאבים בחנות. לפעמים מוצגים פריטים של טאב לא נכון. מה הבאג ואיך מתקנים?",
  code:`async void OnTabClicked(string tab)
{
    var items = await Api.GetShopItemsAsync(tab);
    grid.Show(items);
}`,
  sol:`private CancellationTokenSource tabCts;
private string currentTab;

async void OnTabClicked(string tab)
{
    currentTab = tab;
    tabCts?.Cancel();
    tabCts?.Dispose();
    tabCts = new CancellationTokenSource();
    var token = tabCts.Token;
    try
    {
        var items = await Api.GetShopItemsAsync(tab, token);
        if (token.IsCancellationRequested || tab != currentTab || this == null) return;
        grid.Show(items);
    }
    catch (OperationCanceledException) { }
}`,
  p:[["תשובות חוזרות בסדר שונה – האחרונה שחוזרת דורסת","סדר|אחרונה|דורסת|race"],
     ["ביטול הבקשה הקודמת","ביטול|cancel|קודמת"],
     ["בדיקה שהתשובה עדיין רלוונטית (currentTab / Request id)","רלוונטי|currenttab|request id"],
     ["this == null אחרי await","this == null"],
     ["async void – לטפל בחריגות","async void|exception"]],
  t:"זה אותו עיקרון כמו גלילה מהירה בחנות: לבדוק רלוונטיות כשהתשובה מגיעה." },
{ id:"c-scriptable-events", k:"review", lv:2, time:8, title:"ScriptableObject כ-Event Channel",
  prompt:"מישהו מציע להשתמש ב-ScriptableObject בתור ערוץ אירועים גלובלי. הסבר את היתרונות והסיכונים, ותן הערת Review אחת לקוד.",
  code:`[CreateAssetMenu]
public class GameEvent : ScriptableObject
{
    private readonly List<Action> listeners = new List<Action>();
    public void Raise() { foreach (var l in listeners) l(); }
    public void Register(Action a) => listeners.Add(a);
    public void Unregister(Action a) => listeners.Remove(a);
}`,
  sol:`יתרונות: Decoupling – מערכות לא מכירות זו את זו, וחיבור דרך Inspector.
סיכונים: קשה לעקוב אחרי מי מאזין, State שנשאר ב-SO בין Play Sessions ב-Editor, וקוד שלא מבטל הרשמה.
באג בקוד: Raise עובר על listeners עם foreach, ואם מאזין מבטל הרשמה בתוך הטיפול – InvalidOperationException. תיקון: לעבור לולאה הפוכה עם for, או להעתיק לרשימה זמנית שמוקצית פעם אחת.`,
  p:[["Decoupling ו-Inspector","decoupling|inspector"],
     ["קשה לעקוב אחרי Flow","לעקוב|flow|דיבאג"],
     ["State שנשאר ב-SO ב-Editor","state|editor|נשאר"],
     ["שינוי הרשימה בזמן foreach","foreach|invalidoperation|לשנות"],
     ["תיקון: for הפוך / העתק","הפוך|reverse|העתק|copy"]],
  t:"" },
{ id:"c-explain-big-o", k:"explain", lv:1, time:4, title:"הסבר בעל פה: Big-O במשחק",
  prompt:"תן שלוש דוגמאות מקוד משחק אמיתי לפעולות O(1), O(n) ו-O(n²), ומתי O(n²) הופך לבעיה.",
  code:"",
  sol:`O(1): Lookup ב-Dictionary לפי Id של פריט. O(n): מעבר על כל האויבים כדי למצוא את הקרוב ביותר. O(n²): בדיקת מרחק בין כל זוג אויבים (Collision ידני). עם 20 אויבים זה 400 בדיקות – זניח. עם 2,000 זה 4 מיליון בכל Frame – בעיה. פתרון: Spatial Partitioning (Grid), או מערכת הפיזיקה של Unity.`,
  p:[["O(1) – Dictionary","o(1)|dictionary"],
     ["O(n) – מעבר על רשימה","o(n)|מעבר"],
     ["O(n²) – כל זוג","o(n²)|n^2|n2|זוג"],
     ["מתי הופך לבעיה – n גדול כל Frame","n גדול|כל frame|מיליון"],
     ["Spatial Partitioning / Grid","grid|spatial|רשת"]],
  t:"" },
{ id:"c-live-ai", k:"live", lv:3, time:40, title:"Live Coding עם AI מותר",
  prompt:"תרחיש: בריאיון מאפשרים לך להשתמש ב-Claude Code או Cursor. המשימה: להוסיף מערכת Daily Rewards (7 ימים, איפוס אם מפספסים יום, זמן מהשרת). תתאר בקול את ה-Prompts שאתה כותב, מה אתה בודק בכל Diff, ואיך אתה מוודא שהתוצאה נכונה.",
  code:`// נתון מהשרת: { "lastClaimDay": 19650, "streak": 3, "serverDay": 19651 }
// day = מספר ימים מאז 1970-01-01 לפי UTC`,
  sol:`תהליך מצופה:
1. Prompt ראשון: לבקש תוכנית ומבנה מחלקות לפני קוד, עם ההגבלה שזמן מגיע מהשרת.
2. לוגיקה טהורה ב-C# (בלי MonoBehaviour) כדי לבדוק אותה:
   canClaim = serverDay > lastClaimDay
   newStreak = (serverDay == lastClaimDay + 1) ? (streak % 7) + 1 : 1
3. לבקש Unit Tests: יום רצוף, יום שהוחמץ, אותו יום פעמיים, אחרי יום 7.
4. לעבור על כל Diff: אין DateTime.Now, אין לוגיקת תגמול בלקוח (השרת מעניק), אין קבצים שלא ביקשתי.
5. להריץ את הבדיקות ולתקן.
6. להסביר במילים שלך מה הקוד עושה.`,
  p:[["תוכנית לפני קוד","תוכנית|plan|לפני קוד"],
     ["Prompts ממוקדים עם אילוצים","prompt|אילוצים|constraints"],
     ["לוגיקה טהורה שאפשר לבדוק","טהור|pure|בדיקה"],
     ["Review של כל Diff","diff|review"],
     ["זמן מהשרת ולא מהמכשיר","שרת|datetime.now"],
     ["Unit Tests למקרי קצה","test|מקרי קצה"],
     ["הסבר אישי של הקוד","להסביר|מבין"]],
  t:"משרה AI-first: הם עשויים לבדוק איך אתה עובד עם AI ולא רק אם אתה יודע בלי. שווה להתכונן לשני המצבים." },
{ id:"c-memory-snapshot", k:"explain", lv:3, time:6, title:"הסבר בעל פה: חקירת Memory Leak",
  prompt:"אחרי 10 כניסות ויציאות מהחנות, הזיכרון במכשיר עולה ולא יורד. תאר צעד-אחר-צעד איך תמצא מה דולף עם Memory Profiler.",
  code:"",
  sol:`1. Snapshot לפני כניסה לחנות. 2. כניסה ויציאה 10 פעמים. 3. Snapshot נוסף. 4. Compare בין ה-Snapshots: מה התווסף ולא שוחרר (Textures, Meshes, אובייקטים מנוהלים). 5. ל-Asset חשוד – לבדוק References: מי מחזיק אותו (Event Handler, Static List, Handle של Addressables שלא שוחרר, Cache). 6. לתקן ולחזור על המדידה.`,
  p:[["Snapshot לפני ואחרי","snapshot|לפני|אחרי"],
     ["Compare בין Snapshots","compare|השוואה"],
     ["לבדוק מה מחזיק Reference","reference|מחזיק|retain"],
     ["חשודים: Events, Static, Handles, Cache","event|static|handle|cache"],
     ["מדידה חוזרת אחרי תיקון","חוזרת|לאמת"]],
  t:"" },
{ id:"c-explain-pattern", k:"explain", lv:2, time:5, title:"הסבר בעל פה: Strategy מול State",
  prompt:"מה ההבדל בין Strategy Pattern ל-State Pattern? תן דוגמה לכל אחד ממשחק.",
  code:"",
  sol:`שניהם מחליפים התנהגות דרך אובייקט, אבל: Strategy – ההתנהגות נבחרת מבחוץ ולא משנה את עצמה (למשל אלגוריתם חישוב תגמול שונה לכל אירוע). State – האובייקט מחליף מצב בעצמו לפי מה שקורה, וכל מצב יודע לאיזה מצב לעבור (למשל מכונת Spin: Idle → Spinning → ShowingResult).`,
  p:[["שניהם מבוססים על החלפת אובייקט התנהגות","החלפה|התנהגות|אובייקט"],
     ["Strategy נבחר מבחוץ","מבחוץ|נבחר"],
     ["State משנה את עצמו לפי מעברים","מעברים|משנה את עצמו"],
     ["דוגמה לכל אחד","דוגמה"]],
  t:"" }
];
