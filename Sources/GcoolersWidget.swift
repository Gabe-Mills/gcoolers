import WidgetKit
import SwiftUI

private let supportDir = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/Gcoolers")

struct GcoolersSnapshot {
    var peak: Double = 0
    var cpu: Double = 0
    var gpu: Double = 0
    var zone: String = "—"
    var why: String = "Waiting for Gcoolers……"
    var meeting: Bool = false
    var profile: String = "balanced"
    var date: Date = Date()
}

enum GcoolersStore {
    static func read() -> GcoolersSnapshot {
        let url = supportDir.appendingPathComponent("state.json")
        guard let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return GcoolersSnapshot()
        }
        return GcoolersSnapshot(
            peak: obj["peak_f"] as? Double ?? 0,
            cpu: obj["cpu_f"] as? Double ?? 0,
            gpu: obj["gpu_f"] as? Double ?? 0,
            zone: obj["zone"] as? String ?? "—",
            why: obj["why"] as? String ?? "Gcoolers idle",
            meeting: obj["meeting"] as? Bool ?? false,
            profile: obj["profile"] as? String ?? "balanced",
            date: Date(timeIntervalSince1970: obj["ts"] as? Double ?? Date().timeIntervalSince1970)
        )
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), snap: GcoolersSnapshot(peak: 118, zone: "AUTO", why: "Apple Silicon thermal governor"))
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), snap: GcoolersStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let snap = GcoolersStore.read()
        let entry = Entry(date: Date(), snap: snap)
        let next = Calendar.current.date(byAdding: .second, value: 30, to: Date()) ?? Date().addingTimeInterval(30)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let snap: GcoolersSnapshot
}

struct GcoolersWidgetEntryView: View {
    var entry: Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            small
        case .systemMedium:
            medium
        default:
            medium
        }
    }

    private var accent: Color {
        let z = entry.snap.zone.uppercased()
        if z.contains("MAX") || entry.snap.meeting { return Color(red: 1.0, green: 0.45, blue: 0.35) }
        if z.contains("AUTO") { return Color(red: 0.25, green: 0.85, blue: 0.75) }
        return Color(red: 0.35, green: 0.75, blue: 1.0)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: entry.snap.meeting ? "mic.fill" : "snowflake")
                Text("Gcoolers")
                    .font(.caption.weight(.semibold))
                Spacer()
            }
            .foregroundStyle(accent)
            Text(String(format: "%.0f°", entry.snap.peak))
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.7)
            Text(entry.snap.zone)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .containerBackground(for: .widget) {
            Color(red: 0.05, green: 0.09, blue: 0.14)
        }
    }

    private var medium: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: entry.snap.meeting ? "mic.fill" : "snowflake")
                    Text("Gcoolers")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(accent)
                Text(String(format: "%.0f°F", entry.snap.peak))
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                Text(entry.snap.zone + " · " + entry.snap.profile)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 6) {
                metric("CPU", entry.snap.cpu)
                metric("GPU", entry.snap.gpu)
                Text(entry.snap.why)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.trailing)
            }
            .frame(maxWidth: 180, alignment: .trailing)
        }
        .padding(14)
        .containerBackground(for: .widget) {
            Color(red: 0.05, green: 0.09, blue: 0.14)
        }
    }

    private func metric(_ label: String, _ v: Double) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(String(format: "%.0f°", v))
                .font(.caption.monospacedDigit().weight(.semibold))
        }
    }
}

@main
struct GcoolersWidgets: WidgetBundle {
    var body: some Widget {
        GcoolersTempWidget()
    }
}

struct GcoolersTempWidget: Widget {
    let kind = "GcoolersTempWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            GcoolersWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Gcoolers")
        .description("Live Apple Silicon temps, zone, and why the fans are running.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
