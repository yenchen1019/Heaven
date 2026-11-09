/** 靈魂可能所在的地方 */
public enum Realm {
    WAITING("等待審判"),
    HEAVEN("天堂"),
    PURGATORY("煉獄"),
    HELL("地獄");

    private final String displayName;

    Realm(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
