import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;

/** 整個死後世界，負責管理靈魂與每天的變化 */
public class Afterlife {
    private static final String[] SURNAMES = {"陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊", "許", "鄭"};
    private static final String[] GIVEN = {"志明", "春嬌", "小美", "大雄", "建國", "淑芬", "家豪", "怡君", "冠宇", "雅婷", "俊傑", "美玲"};

    private final List<Soul> souls = new ArrayList<>();
    private final Random rng = new Random();
    private int day = 1;
    private int reincarnations;

    public Soul createSoul(String name, int age) {
        Soul s = new Soul(name, age);
        souls.add(s);
        return s;
    }

    public Soul createRandomSoul() {
        String name = SURNAMES[rng.nextInt(SURNAMES.length)] + GIVEN[rng.nextInt(GIVEN.length)];
        Soul s = createSoul(name, 18 + rng.nextInt(80));
        giveRandomLife(s);
        return s;
    }

    /** 依年齡隨機產生生前做過的事 */
    private void giveRandomLife(Soul s) {
        int count = 3 + s.age() / 10 + rng.nextInt(4);
        for (int i = 0; i < count; i++) {
            s.addDeed(Deed.random(rng));
        }
    }

    /** 審判單一靈魂，回傳判決文字 */
    public String judge(Soul s) {
        s.moveTo(Judge.decide(s.karma()));
        return Judge.verdict(s);
    }

    public Random rng() { return rng; }

    /** 審判所有等待中的靈魂，回傳審判紀錄 */
    public List<String> judgeAll() {
        List<String> log = new ArrayList<>();
        for (Soul s : souls) {
            if (s.realm() == Realm.WAITING) {
                Realm r = Judge.decide(s.karma());
                s.moveTo(r);
                log.add(String.format("%s（業力 %+d）%s", s.name(), s.karma(), Judge.verdict(s)));
            }
        }
        return log;
    }

    /** 過一天，回傳當天發生的事件 */
    public List<String> advanceDay() {
        List<String> log = new ArrayList<>();
        log.add("===== 第 " + day + " 天 =====");

        for (Soul s : souls) {
            s.passDay();
            switch (s.realm()) {
                case HELL -> tickHell(s, log);
                case PURGATORY -> tickPurgatory(s, log);
                case HEAVEN -> tickHeaven(s, log);
                case WAITING -> { }
            }
        }

        // 每天都有新的亡魂抵達
        int arrivals = rng.nextInt(3);
        for (int i = 0; i < arrivals; i++) {
            Soul s = createRandomSoul();
            log.add("☁ 新亡魂抵達：" + s.name() + "（享年 " + s.age() + " 歲），等待審判");
        }

        day++;
        return log;
    }

    private void tickHell(Soul s, List<String> log) {
        s.changeKarma(1 + rng.nextInt(5)); // 受刑贖罪
        if (rng.nextInt(10) == 0) {
            String[] punish = {"上刀山", "下油鍋", "被拔舌", "在寒冰地獄發抖"};
            log.add("🔥 " + s.name() + " 正在" + punish[rng.nextInt(punish.length)]);
        }
        if (Judge.decide(s.karma()) != Realm.HELL) {
            s.moveTo(Realm.PURGATORY);
            log.add("⬆ " + s.name() + " 刑期已滿，從地獄升到煉獄");
        }
    }

    private void tickPurgatory(Soul s, List<String> log) {
        // 多數時候在修行，偶爾心生惡念
        if (rng.nextInt(10) < 7) {
            s.changeKarma(2 + rng.nextInt(5));
        } else {
            s.changeKarma(-(1 + rng.nextInt(6)));
        }
        Realm r = Judge.decide(s.karma());
        if (r == Realm.HEAVEN) {
            s.moveTo(Realm.HEAVEN);
            log.add("✨ " + s.name() + " 修行圓滿，升上天堂！");
        } else if (r == Realm.HELL) {
            s.moveTo(Realm.HELL);
            log.add("⬇ " + s.name() + " 在煉獄墮落，被打入地獄");
        }
    }

    private void tickHeaven(Soul s, List<String> log) {
        // 在天堂住滿 30 天後，每天有機會選擇轉世
        if (s.daysInRealm() >= 30 && rng.nextInt(20) == 0) {
            s.reincarnate(18 + rng.nextInt(80));
            giveRandomLife(s);
            reincarnations++;
            log.add("♻ " + s.name() + " 選擇轉世投胎，過完第 " + s.lifeCount() + " 世後再次回來等待審判");
        }
    }

    public List<Soul> soulsIn(Realm realm) {
        return souls.stream().filter(s -> s.realm() == realm).toList();
    }

    public Optional<Soul> findById(int id) {
        return souls.stream().filter(s -> s.id() == id).findFirst();
    }

    public List<Soul> souls() { return souls; }
    public int day() { return day; }
    public int reincarnations() { return reincarnations; }
}
