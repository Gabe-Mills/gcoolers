import Cocoa
import WidgetKit

let support = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Gcoolers")
let stateURL = support.appendingPathComponent("state.json")
let cmdURL = support.appendingPathComponent("cmd")
let configURL = support.appendingPathComponent("config.json")
let historyURL = support.appendingPathComponent("history.json")
let appVersion = "3.00"

func writeCmd(_ s: String) {
    try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
    try? s.data(using: .utf8)?.write(to: cmdURL)
}

func readJSON(_ url: URL) -> [String: Any] {
    guard let data = try? Data(contentsOf: url),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return [:]
    }
    return obj
}

func readState() -> [String: Any] { readJSON(stateURL) }
func readConfig() -> [String: Any] {
    let c = readJSON(configURL)
    return c.isEmpty ? ["notify": true] : c
}
func readHistory() -> [String: Any] { readJSON(historyURL) }

func writeConfig(_ cfg: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: cfg, options: [.prettyPrinted, .sortedKeys]) else { return }
    try? data.write(to: configURL)
}

final class SparklineView: NSView {
    var values: [Double] = []
    var lo: Double = 100
    var hi: Double = 160

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard values.count > 1 else { return }
        let bounds = self.bounds.insetBy(dx: 8, dy: 10)
        let span = max(1.0, hi - lo)
        let path = NSBezierPath()
        path.lineWidth = 2.0
        for (i, v) in values.enumerated() {
            let x = bounds.minX + bounds.width * CGFloat(i) / CGFloat(values.count - 1)
            let t = max(0, min(1, (v - lo) / span))
            let y = bounds.minY + bounds.height * CGFloat(t)
            if i == 0 { path.move(to: NSPoint(x: x, y: y)) }
            else { path.line(to: NSPoint(x: x, y: y)) }
        }
        NSColor.systemTeal.setStroke()
        path.stroke()

        // max marker line
        let maxV = values.max() ?? lo
        let ty = bounds.minY + bounds.height * CGFloat(max(0, min(1, (maxV - lo) / span)))
        let guide = NSBezierPath()
        guide.lineWidth = 1
        let dashes: [CGFloat] = [3, 3]
        guide.setLineDash(dashes, count: 2, phase: 0)
        guide.move(to: NSPoint(x: bounds.minX, y: ty))
        guide.line(to: NSPoint(x: bounds.maxX, y: ty))
        NSColor.systemOrange.withAlphaComponent(0.55).setStroke()
        guide.stroke()
    }
}

final class HistoryController: NSWindowController, NSWindowDelegate {
    let spark = SparklineView(frame: .zero)
    let whyLabel = NSTextField(labelWithString: "")
    let metaLabel = NSTextField(labelWithString: "")
    let eventsLabel = NSTextField(wrappingLabelWithString: "")
    var refreshTimer: Timer?

    convenience init() {
        let win = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 280),
            styleMask: [.titled, .closable, .utilityWindow, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        win.title = "Gcoolers · last hour"
        win.isFloatingPanel = true
        win.level = .floating
        win.backgroundColor = NSColor.windowBackgroundColor
        self.init(window: win)

        let root = NSView(frame: win.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        win.contentView = root

        whyLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        whyLabel.lineBreakMode = .byTruncatingTail
        whyLabel.translatesAutoresizingMaskIntoConstraints = false

        metaLabel.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        metaLabel.textColor = .secondaryLabelColor
        metaLabel.translatesAutoresizingMaskIntoConstraints = false

        spark.translatesAutoresizingMaskIntoConstraints = false
        spark.wantsLayer = true
        spark.layer?.cornerRadius = 8
        spark.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        eventsLabel.font = NSFont.systemFont(ofSize: 11)
        eventsLabel.textColor = .secondaryLabelColor
        eventsLabel.translatesAutoresizingMaskIntoConstraints = false
        eventsLabel.maximumNumberOfLines = 8

        root.addSubview(whyLabel)
        root.addSubview(metaLabel)
        root.addSubview(spark)
        root.addSubview(eventsLabel)

        NSLayoutConstraint.activate([
            whyLabel.topAnchor.constraint(equalTo: root.topAnchor, constant: 12),
            whyLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 14),
            whyLabel.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -14),

            metaLabel.topAnchor.constraint(equalTo: whyLabel.bottomAnchor, constant: 4),
            metaLabel.leadingAnchor.constraint(equalTo: whyLabel.leadingAnchor),
            metaLabel.trailingAnchor.constraint(equalTo: whyLabel.trailingAnchor),

            spark.topAnchor.constraint(equalTo: metaLabel.bottomAnchor, constant: 10),
            spark.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            spark.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),
            spark.heightAnchor.constraint(equalToConstant: 110),

            eventsLabel.topAnchor.constraint(equalTo: spark.bottomAnchor, constant: 10),
            eventsLabel.leadingAnchor.constraint(equalTo: whyLabel.leadingAnchor),
            eventsLabel.trailingAnchor.constraint(equalTo: whyLabel.trailingAnchor),
            eventsLabel.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor, constant: -12),
        ])
    }

    func showNearStatusItem(_ button: NSStatusBarButton?) {
        reload()
        if let button, let win = window {
            if let screen = button.window?.screen ?? NSScreen.main {
                let buttonRect = button.window?.convertToScreen(button.convert(button.bounds, to: nil))
                    ?? NSRect(x: screen.frame.midX, y: screen.frame.maxY - 40, width: 1, height: 1)
                let origin = NSPoint(
                    x: min(buttonRect.midX - win.frame.width / 2, screen.visibleFrame.maxX - win.frame.width - 8),
                    y: buttonRect.minY - win.frame.height - 8
                )
                win.setFrameOrigin(origin)
            }
        }
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        refreshTimer?.invalidate()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.reload()
        }
    }

    func reload() {
        let st = readState()
        let hist = readHistory()
        let samples = (hist["samples"] as? [[String: Any]]) ?? []
        let events = (hist["events"] as? [[String: Any]]) ?? []
        let peaks = samples.compactMap { $0["peak"] as? Double }
        spark.values = peaks
        if let mn = peaks.min(), let mx = peaks.max() {
            spark.lo = min(100, mn - 5)
            spark.hi = max(160, mx + 5)
        }
        spark.needsDisplay = true

        whyLabel.stringValue = (st["why"] as? String) ?? "learning thermal pattern…"
        let peak = st["peak_f"] as? Double ?? 0
        let cpu = st["cpu_f"] as? Double ?? 0
        let gpu = st["gpu_f"] as? Double ?? 0
        let zone = st["zone"] as? String ?? "—"
        let load = st["load"] as? String ?? "—"
        metaLabel.stringValue = String(
            format: "peak %.0f°  CPU %.0f°  GPU %.0f°  ·  %@  ·  load %@",
            peak, cpu, gpu, zone, load
        )

        let fmt = DateFormatter()
        fmt.dateFormat = "h:mm a"
        if events.isEmpty {
            eventsLabel.stringValue = "No MAX events in the last hour."
        } else {
            let lines = events.suffix(6).reversed().map { e -> String in
                let t = Date(timeIntervalSince1970: e["t"] as? Double ?? 0)
                let p = e["peak"] as? Double ?? 0
                let z = e["zone"] as? String ?? "MAX"
                return "\(fmt.string(from: t))  \(String(format: "%.0f°", p))  \(z)"
            }
            eventsLabel.stringValue = "MAX events\n" + lines.joined(separator: "\n")
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var item: NSStatusItem!
    var timer: Timer?
    var history: HistoryController?
    var lastWidgetReload: TimeInterval = 0
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = Self.makeDockIcon()

        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            let cfg = NSImage.SymbolConfiguration(pointSize: 13, weight: .semibold)
            let img = NSImage(systemSymbolName: "snowflake", accessibilityDescription: "Gcoolers")?
                .withSymbolConfiguration(cfg)
            img?.isTemplate = true
            button.image = img
            button.imagePosition = .imageLeading
            button.title = " —"
            button.font = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)
            button.toolTip = "Gcoolers v\(appVersion)"
        }
        rebuildMenu()
        timer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        refresh()
    }

    static func makeDockIcon() -> NSImage {
        let size: CGFloat = 256
        let img = NSImage(size: NSSize(width: size, height: size))
        img.lockFocus()
        let rect = NSRect(x: 0, y: 0, width: size, height: size)
        let bg = NSBezierPath(roundedRect: rect.insetBy(dx: 12, dy: 12), xRadius: 56, yRadius: 56)
        NSColor(calibratedRed: 0.02, green: 0.42, blue: 0.72, alpha: 1).setFill()
        bg.fill()
        let glow = NSBezierPath(roundedRect: rect.insetBy(dx: 28, dy: 28), xRadius: 46, yRadius: 46)
        NSColor(calibratedRed: 0.55, green: 0.90, blue: 1.0, alpha: 0.28).setFill()
        glow.fill()
        let cfg = NSImage.SymbolConfiguration(pointSize: 120, weight: .bold)
        if let sym = NSImage(systemSymbolName: "snowflake", accessibilityDescription: "Gcoolers")?
            .withSymbolConfiguration(cfg) {
            let s: CGFloat = 140
            let r = NSRect(x: (size - s) / 2, y: (size - s) / 2 - 4, width: s, height: s)
            NSColor.white.set()
            sym.draw(in: r, from: .zero, operation: .sourceOver, fraction: 1.0)
        }
        img.unlockFocus()
        return img
    }

    func refresh() {
        let st = readState()
        let peak = st["peak_f"] as? Double ?? 0
        let cpu = st["cpu_f"] as? Double ?? 0
        let gpu = st["gpu_f"] as? Double ?? 0
        let zone = st["zone"] as? String ?? "—"
        let paused = st["paused"] as? Bool ?? false
        let profile = st["profile"] as? String ?? "balanced"
        let boost = st["boost_until"] as? Double ?? 0
        let boosting = boost > Date().timeIntervalSince1970
        let why = st["why"] as? String ?? ""
        let meeting = st["meeting"] as? Bool ?? false
        let schedule = st["schedule"] as? String ?? "off"
        if let button = item.button {
            if paused {
                button.title = " pause"
            } else if meeting {
                button.title = String(format: " 🔇%.0f°", peak)
            } else if boosting {
                button.title = String(format: " ⚡%.0f°", peak)
            } else if peak > 0 {
                button.title = String(format: " %.0f°", peak)
            } else {
                button.title = " …"
            }
            button.toolTip = why.isEmpty
                ? String(format: "Gcoolers v%@ · %@", appVersion, zone)
                : "Gcoolers v\(appVersion)\n\(why)"
        }
        rebuildMenu(
            peak: peak, cpu: cpu, gpu: gpu, zone: zone,
            paused: paused, profile: profile, boosting: boosting, why: why,
            meeting: meeting, schedule: schedule
        )
        // Keep Notification Center / desktop widgets fresh
        let now = Date().timeIntervalSince1970
        if now - lastWidgetReload > 15 {
            lastWidgetReload = now
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    func rebuildMenu(
        peak: Double = 0,
        cpu: Double = 0,
        gpu: Double = 0,
        zone: String = "—",
        paused: Bool = false,
        profile: String = "balanced",
        boosting: Bool = false,
        why: String = "",
        meeting: Bool = false,
        schedule: String = "off"
    ) {
        let menu = NSMenu()
        let header = menu.addItem(withTitle: "Gcoolers  v\(appVersion)", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(withTitle: String(format: "Peak  %.1f°F   ·   %@", peak, zone), action: nil, keyEquivalent: "")
        menu.addItem(withTitle: String(format: "CPU   %.1f°F    GPU  %.1f°F", cpu, gpu), action: nil, keyEquivalent: "")
        if !why.isEmpty {
            let w = menu.addItem(withTitle: why, action: nil, keyEquivalent: "")
            w.isEnabled = false
        }
        menu.addItem(withTitle: "Profile · \(profile)", action: nil, keyEquivalent: "")
        menu.addItem(.separator())

        let histItem = menu.addItem(withTitle: "Hour history…", action: #selector(showHistory), keyEquivalent: "h")
        histItem.target = self
        let widgetHelp = menu.addItem(withTitle: "Add Widget…", action: #selector(showWidgetHelp), keyEquivalent: "w")
        widgetHelp.target = self
        let exp = menu.addItem(withTitle: "Export hour…", action: #selector(doExport), keyEquivalent: "e")
        exp.target = self

        menu.addItem(.separator())
        let meet = menu.addItem(
            withTitle: meeting ? "Meeting mode · On" : "Meeting mode · Off",
            action: #selector(toggleMeeting),
            keyEquivalent: "m"
        )
        meet.target = self
        meet.state = meeting ? .on : .off
        let meetAuto = menu.addItem(withTitle: "Meeting · Auto-detect", action: #selector(meetingAuto), keyEquivalent: "")
        meetAuto.target = self

        let schedOn = (readConfig()["schedule_enabled"] as? Bool) ?? false
        let sched = menu.addItem(
            withTitle: schedOn ? "Schedule · On (\(schedule))" : "Schedule · Off",
            action: #selector(toggleSchedule),
            keyEquivalent: "s"
        )
        sched.target = self
        sched.state = schedOn ? .on : .off

        menu.addItem(.separator())
        let pause = menu.addItem(
            withTitle: paused ? "Resume cooling" : "Pause cooling",
            action: #selector(togglePause),
            keyEquivalent: "p"
        )
        pause.target = self

        let boostItem = menu.addItem(
            withTitle: boosting ? "Boost active…" : "Boost fans 60s",
            action: #selector(doBoost),
            keyEquivalent: "b"
        )
        boostItem.target = self
        boostItem.isEnabled = !boosting

        menu.addItem(.separator())
        for (title, cmd) in [("Force AUTO", "auto"), ("Force MAX", "max"), ("Clear force", "clear")] {
            let it = menu.addItem(withTitle: title, action: #selector(sendCmd(_:)), keyEquivalent: "")
            it.representedObject = cmd
            it.target = self
        }

        menu.addItem(.separator())
        let prof = NSMenu()
        for name in ["quiet", "balanced", "cool"] {
            let it = prof.addItem(withTitle: name.capitalized, action: #selector(sendCmd(_:)), keyEquivalent: "")
            it.representedObject = "profile \(name)"
            it.target = self
            if name == profile { it.state = .on }
        }
        let pitem = menu.addItem(withTitle: "Profiles", action: nil, keyEquivalent: "")
        menu.setSubmenu(prof, for: pitem)

        menu.addItem(.separator())
        let notifyOn = (readConfig()["notify"] as? Bool) ?? true
        let nitem = menu.addItem(
            withTitle: notifyOn ? "Notifications · On" : "Notifications · Off",
            action: #selector(toggleNotify),
            keyEquivalent: "n"
        )
        nitem.target = self
        nitem.state = notifyOn ? .on : .off

        menu.addItem(.separator())
        let quit = menu.addItem(withTitle: "Quit Gcoolers", action: #selector(NSApp.terminate(_:)), keyEquivalent: "q")
        quit.target = NSApp
        item.menu = menu
    }

    @objc func showHistory() {
        if history == nil { history = HistoryController() }
        history?.showNearStatusItem(item.button)
    }

    @objc func showWidgetHelp() {
        let alert = NSAlert()
        alert.messageText = "Add the Gcoolers widget (gcoolers.com)"
        alert.informativeText = """
1. Open Notification Center (click date/time) or right‑click the desktop
2. Choose Edit Widgets
3. Search for “Gcoolers”
4. Add the small or medium widget

It shows live temp, zone, CPU/GPU, and why the fans are running.
"""
        alert.addButton(withTitle: "OK")
        alert.runModal()
        WidgetCenter.shared.reloadAllTimelines()
    }

    @objc func doExport() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: NSHomeDirectory() + "/bin/gcoolers")
        task.arguments = ["export"]
        try? task.run()
    }

    @objc func toggleMeeting() { writeCmd("meeting") }
    @objc func meetingAuto() { writeCmd("meeting auto") }
    @objc func toggleSchedule() { writeCmd("schedule") }

    @objc func togglePause() {
        let st = readState()
        let paused = st["paused"] as? Bool ?? false
        writeCmd(paused ? "resume" : "pause")
    }

    @objc func doBoost() { writeCmd("boost") }

    @objc func toggleNotify() {
        var cfg = readConfig()
        let on = (cfg["notify"] as? Bool) ?? true
        cfg["notify"] = !on
        writeConfig(cfg)
        refresh()
    }

    @objc func sendCmd(_ sender: NSMenuItem) {
        if let cmd = sender.representedObject as? String { writeCmd(cmd) }
    }
}

let app = NSApplication.shared
let del = AppDelegate()
app.delegate = del
app.run()
