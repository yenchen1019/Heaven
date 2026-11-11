import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 網頁版：提供網頁和 JSON API，開瀏覽器就能玩 */
public class WebServer {
    private static final Afterlife world = new Afterlife();
    private static final Map<Integer, LifeGame> lives = new HashMap<>();

    public static void main(String[] args) throws IOException {
        // 雲端平台（例如 Render）會用環境變數 PORT 指定 port，這時要開放給外部連線
        String envPort = System.getenv("PORT");
        int port = envPort != null ? Integer.parseInt(envPort)
                : args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        String host = envPort != null ? "0.0.0.0" : "127.0.0.1";
        System.out.println("題庫已載入：" + Scenario.all().size() + " 題");

        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.createContext("/", WebServer::serveIndex);
        server.createContext("/api/", WebServer::handleApi);
        server.start();
        System.out.println("天堂地獄模擬器已啟動：http://localhost:" + port);
        System.out.println("按 Ctrl+C 結束");
    }

    /** 提供 web 資料夾裡的靜態檔案（網頁、JS） */
    private static void serveIndex(HttpExchange ex) throws IOException {
        String p = ex.getRequestURI().getPath();
        if (p.equals("/")) p = "/index.html";
        // 網頁版直接讀題庫檔（game.js 會抓 scenarios.txt）
        if (p.equals("/scenarios.txt")) {
            send(ex, 200, "text/plain", Files.readString(Path.of("data", "scenarios.txt"), StandardCharsets.UTF_8));
            return;
        }
        Path base = Path.of("web").toAbsolutePath().normalize();
        Path file = base.resolve(p.substring(1)).normalize();
        if (!file.startsWith(base) || !Files.isRegularFile(file)) {
            send(ex, 404, "text/plain", "Not found");
            return;
        }
        String name = file.getFileName().toString();
        String type = name.endsWith(".js") ? "text/javascript"
                : name.endsWith(".css") ? "text/css" : "text/html";
        send(ex, 200, type, Files.readString(file, StandardCharsets.UTF_8));
    }

    private static void handleApi(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        Map<String, String> q = parseQuery(ex.getRequestURI().getRawQuery());
        String json;
        try {
            synchronized (world) {
                json = switch (path) {
                    case "/api/state" -> withLog(List.of());
                    case "/api/deeds" -> deedsJson();
                    case "/api/judge" -> withLog(world.judgeAll());
                    case "/api/day" -> advance(intParam(q, "n", 1));
                    case "/api/random" -> randomSouls(intParam(q, "n", 1));
                    case "/api/create" -> create(q);
                    case "/api/soul" -> soulDetail(intParam(q, "id", 0));
                    case "/api/life/start" -> lifeStart(q.getOrDefault("name", ""));
                    case "/api/life/choose" -> lifeChoose(intParam(q, "life", 0), intParam(q, "option", -1));
                    default -> null;
                };
            }
        } catch (IllegalArgumentException e) {
            send(ex, 400, "application/json", "{\"error\":" + str(e.getMessage()) + "}");
            return;
        }
        if (json == null) send(ex, 404, "application/json", "{\"error\":\"unknown api\"}");
        else send(ex, 200, "application/json", json);
    }

    private static String advance(int n) {
        n = Math.max(1, Math.min(n, 365));
        List<String> log = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            log.addAll(world.advanceDay());
            if (n > 1) log.addAll(world.judgeAll()); // 快轉時自動審判新來的
        }
        return withLog(log);
    }

    private static String randomSouls(int n) {
        n = Math.max(1, Math.min(n, 50));
        List<String> log = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            Soul s = world.createRandomSoul();
            log.add("☁ " + s.name() + "（享年 " + s.age() + " 歲）抵達奈何橋");
        }
        return withLog(log);
    }

    private static String create(Map<String, String> q) {
        String name = q.getOrDefault("name", "").trim();
        if (name.isEmpty()) name = "無名氏";
        if (name.length() > 12) name = name.substring(0, 12);
        int age = Math.max(0, Math.min(intParam(q, "age", 30), 150));
        Soul s = world.createSoul(name, age);
        List<Deed> catalog = Deed.catalog();
        String deeds = q.getOrDefault("deeds", "");
        if (!deeds.isBlank()) {
            for (String part : deeds.split(",")) {
                int idx = Integer.parseInt(part.trim());
                if (idx >= 0 && idx < catalog.size()) s.addDeed(catalog.get(idx));
            }
        }
        return withLog(List.of("☁ " + s.name() + " 的靈魂來到奈何橋，業力 " + String.format("%+d", s.karma())));
    }

    // ===== 人生模式 =====

    private static String lifeStart(String name) {
        name = name.trim();
        if (name.isEmpty()) name = "無名氏";
        if (name.length() > 12) name = name.substring(0, 12);
        LifeGame game = new LifeGame(name, world.rng());
        lives.put(game.id(), game);
        return "{\"life\":" + game.id() + ",\"name\":" + str(game.name())
                + ",\"next\":" + scenarioJson(game) + "}";
    }

    private static String lifeChoose(int lifeId, int option) {
        LifeGame game = lives.get(lifeId);
        if (game == null) throw new IllegalArgumentException("找不到這段人生，請重新開始");
        Scenario.Choice picked = game.choose(option);
        String head = "{\"outcome\":" + str(picked.outcome());
        if (!game.isOver()) {
            return head + ",\"next\":" + scenarioJson(game) + "}";
        }

        // 人生結束：變成靈魂，接受審判
        lives.remove(lifeId);
        int age = 60 + world.rng().nextInt(36);
        Soul soul = world.createSoul(game.name(), age);
        for (Scenario.Choice c : game.picks()) soul.addDeed(new Deed(c.text(), c.karma()));
        String verdict = world.judge(soul);

        List<String> history = new ArrayList<>();
        for (int i = 0; i < game.picks().size(); i++) {
            Scenario sc = game.scenarios().get(i);
            Scenario.Choice c = game.picks().get(i);
            history.add("{\"stage\":" + str(sc.stage()) + ",\"situation\":" + str(sc.situation())
                    + ",\"choice\":" + str(c.text()) + ",\"karma\":" + c.karma() + "}");
        }
        String ending = "{\"soul\":" + soulJson(soul) + ",\"verdict\":" + str(verdict)
                + ",\"history\":[" + String.join(",", history) + "]}";
        String log = "👤 " + soul.name() + "（享年 " + age + " 歲）走完人生，業力 "
                + String.format("%+d", soul.karma()) + "，" + verdict;
        return head + ",\"ending\":" + ending + ",\"state\":" + withLog(List.of(log)) + "}";
    }

    private static String scenarioJson(LifeGame game) {
        Scenario s = game.current();
        String choices = s.choices().stream().map(c -> str(c.text())).collect(Collectors.joining(","));
        return "{\"step\":" + (game.step() + 1) + ",\"total\":" + game.total()
                + ",\"stage\":" + str(s.stage()) + ",\"situation\":" + str(s.situation())
                + ",\"choices\":[" + choices + "]}";
    }

    private static String soulDetail(int id) {
        Soul s = world.findById(id).orElseThrow(() -> new IllegalArgumentException("找不到這個靈魂"));
        String deeds = s.deeds().stream()
                .map(d -> "{\"text\":" + str(d.description()) + ",\"karma\":" + d.karma() + "}")
                .collect(Collectors.joining(","));
        return "{\"soul\":" + soulJson(s) + ",\"deeds\":[" + deeds + "]}";
    }

    private static String deedsJson() {
        return "[" + Deed.catalog().stream()
                .map(d -> "{\"text\":" + str(d.description()) + ",\"karma\":" + d.karma() + "}")
                .collect(Collectors.joining(",")) + "]";
    }

    private static String withLog(List<String> log) {
        String logJson = log.stream().map(WebServer::str).collect(Collectors.joining(","));
        String souls = world.souls().stream().map(WebServer::soulJson).collect(Collectors.joining(","));
        return "{\"day\":" + world.day()
                + ",\"reincarnations\":" + world.reincarnations()
                + ",\"log\":[" + logJson + "]"
                + ",\"souls\":[" + souls + "]}";
    }

    private static String soulJson(Soul s) {
        return "{\"id\":" + s.id()
                + ",\"name\":" + str(s.name())
                + ",\"age\":" + s.age()
                + ",\"karma\":" + s.karma()
                + ",\"realm\":" + str(s.realm().name())
                + ",\"days\":" + s.daysInRealm()
                + ",\"life\":" + s.lifeCount() + "}";
    }

    /** 把字串轉成 JSON 字串（加引號並跳脫特殊字元） */
    private static String str(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '<' -> sb.append("\\u003c");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> map = new HashMap<>();
        if (raw == null || raw.isEmpty()) return map;
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            if (eq < 0) continue;
            map.put(URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
                    URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return map;
    }

    private static int intParam(Map<String, String> q, String key, int def) {
        String v = q.get(key);
        if (v == null || v.isBlank()) return def;
        try {
            return Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(key + " 必須是數字");
        }
    }

    private static void send(HttpExchange ex, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
