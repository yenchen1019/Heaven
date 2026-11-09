import java.util.ArrayList;
import java.util.List;

/** 一個靈魂 */
public class Soul {
    private static int nextId = 1;

    private final int id;
    private final String name;
    private int age;
    private int karma;
    private Realm realm = Realm.WAITING;
    private int daysInRealm;
    private int lifeCount = 1;
    private final List<Deed> deeds = new ArrayList<>();

    public Soul(String name, int age) {
        this.id = nextId++;
        this.name = name;
        this.age = age;
    }

    public void addDeed(Deed deed) {
        deeds.add(deed);
        karma += deed.karma();
    }

    public void changeKarma(int delta) {
        karma += delta;
    }

    public void moveTo(Realm newRealm) {
        if (newRealm != realm) {
            realm = newRealm;
            daysInRealm = 0;
        }
    }

    public void passDay() {
        daysInRealm++;
    }

    /** 轉世：清空前世紀錄，重新開始一段人生 */
    public void reincarnate(int newAge) {
        deeds.clear();
        karma = 0;
        age = newAge;
        lifeCount++;
        realm = Realm.WAITING;
        daysInRealm = 0;
    }

    public int id() { return id; }
    public String name() { return name; }
    public int age() { return age; }
    public int karma() { return karma; }
    public Realm realm() { return realm; }
    public int daysInRealm() { return daysInRealm; }
    public int lifeCount() { return lifeCount; }
    public List<Deed> deeds() { return deeds; }

    @Override
    public String toString() {
        return String.format("#%-3d %-6s 年齡 %-3d 業力 %+5d  [%s 第 %d 天] 第 %d 世",
                id, name, age, karma, realm.displayName(), daysInRealm, lifeCount);
    }
}
