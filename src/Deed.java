import java.util.List;
import java.util.Random;

/** 生前做過的一件事，karma 為正是善行、為負是惡行 */
public record Deed(String description, int karma) {

    private static final List<Deed> CATALOG = List.of(
            new Deed("救助流浪動物", 15),
            new Deed("捐款給慈善機構", 20),
            new Deed("照顧年邁的父母", 25),
            new Deed("見義勇為", 30),
            new Deed("當志工", 10),
            new Deed("撿到錢包歸還失主", 12),
            new Deed("在公車上讓座", 5),
            new Deed("說謊", -5),
            new Deed("亂丟垃圾", -3),
            new Deed("偷竊", -20),
            new Deed("欺負弱小", -25),
            new Deed("背叛朋友", -30),
            new Deed("詐騙老人", -40),
            new Deed("殺人", -100)
    );

    public static Deed random(Random rng) {
        // 嚴重惡行比較少見：抽到殺人時有一半機率改抽別的
        Deed d = CATALOG.get(rng.nextInt(CATALOG.size()));
        if (d.karma() <= -100 && rng.nextBoolean()) {
            d = CATALOG.get(rng.nextInt(CATALOG.size() - 1));
        }
        return d;
    }

    public static List<Deed> catalog() {
        return CATALOG;
    }

    @Override
    public String toString() {
        return String.format("%s (%+d)", description, karma);
    }
}
