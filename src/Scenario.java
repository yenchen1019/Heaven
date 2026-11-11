import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/** 人生中遇到的一個情境，以及可以做的選擇。題目放在 data/scenarios.txt */
public record Scenario(String stage, String situation, List<Choice> choices) {

    /** 一個選擇：選項文字、業力、選了之後發生的事 */
    public record Choice(String text, int karma, String outcome) { }

    public static final List<String> STAGES = List.of("童年", "少年", "青年", "中年", "老年");
    /** 每個階段抽幾題（順序對應 STAGES），一共 7 題 */
    public static final List<Integer> PER_STAGE = List.of(1, 1, 2, 2, 1);
    private static final Path FILE = Path.of("data", "scenarios.txt");

    private static List<Scenario> all;

    /** 讀取題庫（只讀一次） */
    public static synchronized List<Scenario> all() {
        if (all == null) all = load(FILE);
        return all;
    }

    /** 每個人生階段依 PER_STAGE 抽題，選項順序也打亂 */
    public static List<Scenario> randomLife(Random rng) {
        List<Scenario> life = new ArrayList<>();
        for (int k = 0; k < STAGES.size(); k++) {
            String stage = STAGES.get(k);
            List<Scenario> pool = new ArrayList<>(all().stream().filter(s -> s.stage().equals(stage)).toList());
            Collections.shuffle(pool, rng);
            for (Scenario s : pool.subList(0, Math.min(PER_STAGE.get(k), pool.size()))) {
                List<Choice> shuffled = new ArrayList<>(s.choices());
                Collections.shuffle(shuffled, rng);
                life.add(new Scenario(s.stage(), s.situation(), shuffled));
            }
        }
        return life;
    }

    /**
     * 解析題庫檔：
     *   == 階段
     *   ? 情境
     *   - 選項 | 業力 | 結果
     */
    static List<Scenario> load(Path file) {
        List<String> lines;
        try {
            lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("讀不到題庫檔 " + file.toAbsolutePath(), e);
        }

        List<Scenario> result = new ArrayList<>();
        String stage = null, situation = null;
        List<Choice> choices = null;

        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i).strip();
            int lineNo = i + 1;
            if (line.isEmpty() || line.startsWith("#")) continue;

            if (line.startsWith("==")) {
                addIfComplete(result, stage, situation, choices, lineNo);
                situation = null;
                choices = null;
                stage = line.substring(2).strip();
                if (!STAGES.contains(stage)) throw error(lineNo, "未知的人生階段「" + stage + "」，只能是 " + STAGES);
            } else if (line.startsWith("?")) {
                addIfComplete(result, stage, situation, choices, lineNo);
                if (stage == null) throw error(lineNo, "題目前面要先寫 == 階段");
                situation = line.substring(1).strip();
                choices = new ArrayList<>();
            } else if (line.startsWith("-")) {
                if (choices == null) throw error(lineNo, "選項前面要先寫 ? 題目");
                String[] parts = line.substring(1).split("\\|", 3);
                if (parts.length != 3) throw error(lineNo, "選項格式應為：- 選項 | 業力 | 結果");
                int karma;
                try {
                    karma = Integer.parseInt(parts[1].strip());
                } catch (NumberFormatException e) {
                    throw error(lineNo, "業力必須是整數，卻寫了「" + parts[1].strip() + "」");
                }
                choices.add(new Choice(parts[0].strip(), karma, parts[2].strip()));
            } else {
                throw error(lineNo, "看不懂這一行，開頭應該是 ==、? 或 -");
            }
        }
        addIfComplete(result, stage, situation, choices, lines.size());

        for (int k = 0; k < STAGES.size(); k++) {
            String s = STAGES.get(k);
            int need = PER_STAGE.get(k);
            long n = result.stream().filter(sc -> sc.stage().equals(s)).count();
            if (n < need) throw new IllegalStateException("題庫的「" + s + "」只有 " + n + " 題，至少要 " + need + " 題");
        }
        return List.copyOf(result);
    }

    private static void addIfComplete(List<Scenario> out, String stage, String situation, List<Choice> choices, int lineNo) {
        if (situation == null) return;
        if (choices.size() < 2) throw error(lineNo, "題目「" + situation + "」至少要有 2 個選項");
        out.add(new Scenario(stage, situation, List.copyOf(choices)));
    }

    private static IllegalStateException error(int lineNo, String msg) {
        return new IllegalStateException("題庫第 " + lineNo + " 行：" + msg);
    }
}
