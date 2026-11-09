import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** 一位玩家正在進行的人生：依序面對情境並做選擇 */
public class LifeGame {
    private static int nextId = 1;

    private final int id = nextId++;
    private final String name;
    private final List<Scenario> scenarios;
    private final List<Scenario.Choice> picks = new ArrayList<>();

    public LifeGame(String name, Random rng) {
        this.name = name;
        this.scenarios = Scenario.randomLife(rng);
    }

    public Scenario current() {
        return isOver() ? null : scenarios.get(picks.size());
    }

    public Scenario.Choice choose(int option) {
        Scenario s = current();
        if (s == null) throw new IllegalArgumentException("人生已經結束了");
        if (option < 0 || option >= s.choices().size()) throw new IllegalArgumentException("沒有這個選項");
        Scenario.Choice c = s.choices().get(option);
        picks.add(c);
        return c;
    }

    public boolean isOver() { return picks.size() >= scenarios.size(); }
    public int id() { return id; }
    public String name() { return name; }
    public int step() { return picks.size(); }
    public int total() { return scenarios.size(); }
    public List<Scenario> scenarios() { return scenarios; }
    public List<Scenario.Choice> picks() { return picks; }
}
