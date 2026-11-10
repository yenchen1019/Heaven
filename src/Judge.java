/** 閻羅王 / 聖彼得：依業力決定靈魂去處 */
public class Judge {
    /** 業力達到這個分數就能上天堂，不到就下地獄 */
    public static final int HEAVEN_THRESHOLD = 0;

    public static Realm decide(int karma) {
        return karma >= HEAVEN_THRESHOLD ? Realm.HEAVEN : Realm.HELL;
    }

    public static String verdict(Soul soul) {
        return switch (decide(soul.karma())) {
            case HEAVEN -> "行善積德，准入天堂！";
            case HELL -> "罪孽深重，打入地獄！";
            case WAITING -> "";
        };
    }
}
