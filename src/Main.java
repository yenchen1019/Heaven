import java.util.List;
import java.util.Scanner;

/** 天堂地獄模擬器：終端機選單 */
public class Main {
    private static final Scanner in = new Scanner(System.in);
    private static final Afterlife world = new Afterlife();

    public static void main(String[] args) {
        System.out.println("""
                ╔══════════════════════════════╗
                ║      天 堂 地 獄 模 擬 器      ║
                ╚══════════════════════════════╝""");

        // 一開始先放幾個靈魂進來
        for (int i = 0; i < 5; i++) world.createRandomSoul();
        System.out.println("已有 5 個亡魂在奈何橋前等待審判。");

        while (true) {
            System.out.println("""

                    —— 第 %d 天 ——
                    1. 建立自己的靈魂
                    2. 隨機產生亡魂
                    3. 審判所有等待中的靈魂
                    4. 過一天
                    5. 快轉 N 天
                    6. 查看各界名單
                    7. 查看某個靈魂的生平
                    8. 統計
                    0. 離開""".formatted(world.day()));
            switch (readInt("請選擇：")) {
                case 1 -> createOwnSoul();
                case 2 -> randomSouls();
                case 3 -> print(world.judgeAll(), "目前沒有等待審判的靈魂。");
                case 4 -> print(world.advanceDay(), "");
                case 5 -> fastForward();
                case 6 -> showRealms();
                case 7 -> showSoul();
                case 8 -> showStats();
                case 0 -> {
                    System.out.println("願你今生多行善事。再見！");
                    return;
                }
                default -> System.out.println("沒有這個選項。");
            }
        }
    }

    private static void createOwnSoul() {
        System.out.print("名字：");
        String name = in.nextLine().trim();
        if (name.isEmpty()) name = "無名氏";
        int age = readInt("享年幾歲：");
        Soul s = world.createSoul(name, Math.max(age, 0));

        List<Deed> catalog = Deed.catalog();
        System.out.println("選擇生前做過的事（輸入編號，可重複，輸入 0 結束）：");
        for (int i = 0; i < catalog.size(); i++) {
            System.out.printf("  %2d. %s%n", i + 1, catalog.get(i));
        }
        while (true) {
            int n = readInt("> ");
            if (n == 0) break;
            if (n < 1 || n > catalog.size()) {
                System.out.println("沒有這個編號。");
                continue;
            }
            s.addDeed(catalog.get(n - 1));
            System.out.printf("  已記錄，目前業力 %+d%n", s.karma());
        }
        System.out.println(s.name() + " 的靈魂已來到奈何橋，等待審判。");
    }

    private static void randomSouls() {
        int n = readInt("要產生幾個：");
        for (int i = 0; i < n; i++) {
            Soul s = world.createRandomSoul();
            System.out.printf("☁ %s（享年 %d 歲）抵達，業力 %+d%n", s.name(), s.age(), s.karma());
        }
    }

    private static void fastForward() {
        int n = readInt("快轉幾天：");
        for (int i = 0; i < n; i++) {
            List<String> log = world.advanceDay();
            world.judgeAll(); // 快轉時自動審判新來的靈魂
            // 只印重要事件（轉世），避免洗版
            log.stream()
                    .filter(l -> l.startsWith("=") || l.startsWith("♻"))
                    .forEach(System.out::println);
        }
        showStats();
    }

    private static void showRealms() {
        for (Realm r : Realm.values()) {
            List<Soul> list = world.soulsIn(r);
            System.out.println("\n【" + r.displayName() + "】" + list.size() + " 人");
            list.forEach(s -> System.out.println("  " + s));
        }
    }

    private static void showSoul() {
        int id = readInt("靈魂編號：");
        world.findById(id).ifPresentOrElse(s -> {
            System.out.println(s);
            System.out.println("這一世的生平：");
            if (s.deeds().isEmpty()) System.out.println("  （一片空白）");
            s.deeds().forEach(d -> System.out.println("  • " + d));
        }, () -> System.out.println("找不到這個靈魂。"));
    }

    private static void showStats() {
        List<Soul> all = world.souls();
        System.out.println("\n—— 統計（第 " + world.day() + " 天）——");
        System.out.println("總靈魂數：" + all.size());
        for (Realm r : Realm.values()) {
            int c = world.soulsIn(r).size();
            int pct = all.isEmpty() ? 0 : c * 100 / all.size();
            System.out.printf("  %-6s %3d 人 %s%n", r.displayName(), c, "█".repeat(pct / 4));
        }
        double avg = all.stream().mapToInt(Soul::karma).average().orElse(0);
        System.out.printf("平均業力：%+.1f%n", avg);
        System.out.println("累計轉世次數：" + world.reincarnations());
    }

    private static void print(List<String> lines, String emptyMsg) {
        if (lines.isEmpty()) System.out.println(emptyMsg);
        lines.forEach(System.out::println);
    }

    private static int readInt(String prompt) {
        while (true) {
            System.out.print(prompt);
            if (!in.hasNextLine()) System.exit(0);
            String line = in.nextLine().trim();
            try {
                return Integer.parseInt(line);
            } catch (NumberFormatException e) {
                System.out.println("請輸入數字。");
            }
        }
    }
}
