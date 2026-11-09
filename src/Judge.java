/** 閻羅王 / 聖彼得：依業力決定靈魂去處 */
public class Judge {
    public static final int HEAVEN_THRESHOLD = 50;
    public static final int HELL_THRESHOLD = -50;

    public static Realm decide(int karma) {
        if (karma >= HEAVEN_THRESHOLD) return Realm.HEAVEN;
        if (karma <= HELL_THRESHOLD) return Realm.HELL;
        return Realm.PURGATORY;
    }

    public static String verdict(Soul soul) {
        return switch (decide(soul.karma())) {
            case HEAVEN -> "行善積德，准入天堂！";
            case HELL -> "罪孽深重，打入地獄！";
            case PURGATORY -> "善惡參半，前往煉獄修行。";
            case WAITING -> "";
        };
    }
}
