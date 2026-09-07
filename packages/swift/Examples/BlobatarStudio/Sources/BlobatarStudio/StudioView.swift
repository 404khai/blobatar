import BlobatarCore
import BlobatarSwiftUI
import SwiftUI

struct StudioView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var configuration = StudioConfiguration()
  @State private var previewHovered = false

  private let columns = [
    GridItem(.adaptive(minimum: 112, maximum: 150), spacing: 16)
  ]

  var body: some View {
    NavigationView {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          introduction
          preview
          controls
          fixedNames
          crowd
        }
        .frame(maxWidth: 920)
        .padding()
      }
      .navigationTitle("Blobatar Studio")
    }
    #if os(macOS)
      .frame(minWidth: 760, minHeight: 720)
    #endif
  }

  private var introduction: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Deterministic geometric avatars from any string.")
        .font(.title2.weight(.semibold))
      Text(
        "Edit the same public options an application uses, then check one identity or a whole population."
      )
      .foregroundStyle(.secondary)
    }
  }

  private var preview: some View {
    GroupBox("Preview") {
      VStack(spacing: 16) {
        Blobatar(
          name: configuration.name,
          size: 260,
          options: configuration.options,
          accessibilityLabel: "\(displayName) Blobatar"
        )
        .frame(maxWidth: .infinity)

        VStack(spacing: 4) {
          Text(displayName)
            .font(.headline)
            .lineLimit(1)
          Text(
            "\(configuration.shape.rawValue) · \(configuration.expression.rawValue)"
          )
          .font(.caption)
          .foregroundStyle(.secondary)
        }

        motionStatus
      }
      .padding(.vertical, 8)
      .contentShape(Rectangle())
      .onHover { previewHovered = $0 }
    }
  }

  private var motionStatus: some View {
    let active = configuration.motion.isActive(
      isHovered: previewHovered,
      reduceMotion: reduceMotion
    )
    let detail: String
    if reduceMotion && configuration.motion != .staticPreview {
      detail = "Reduced Motion makes this endpoint static"
    } else if configuration.motion == .hover && !previewHovered {
      detail = "Move the pointer over the preview to activate"
    } else if active {
      detail = "Activity policy is active; elapsed-time frames arrive in Phase 6"
    } else {
      detail = "Static endpoint"
    }

    return HStack(spacing: 8) {
      Circle()
        .fill(active ? Color.green : Color.secondary)
        .frame(width: 8, height: 8)
      Text(detail)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }

  private var controls: some View {
    GroupBox("Controls") {
      VStack(alignment: .leading, spacing: 18) {
        TextField("Seed name", text: $configuration.name)
          .textFieldStyle(.roundedBorder)

        pickerRow("Shape", selection: $configuration.shape) {
          ForEach(StudioShape.allCases) { shape in
            Text(shape.rawValue).tag(shape)
          }
        }

        pickerRow("Expression", selection: $configuration.expression) {
          ForEach(BlobatarExpression.allCases, id: \.rawValue) { expression in
            Text(expression.rawValue.capitalized).tag(expression)
          }
        }

        pickerRow("Backdrop", selection: $configuration.backdrop) {
          ForEach(BlobatarBackdrop.allCases, id: \.rawValue) { backdrop in
            Text(backdrop.rawValue.capitalized).tag(backdrop)
          }
        }

        pickerRow("Narrow eye gap", selection: $configuration.eyeGap) {
          ForEach(StudioEyeGap.allCases) { gap in
            Text(gap.rawValue).tag(gap)
          }
        }

        pickerRow("Motion", selection: $configuration.motion) {
          ForEach(StudioMotionMode.allCases) { mode in
            Text(mode.rawValue).tag(mode)
          }
        }

        Divider()

        Toggle("Override hue", isOn: $configuration.overridesHue)
        if configuration.overridesHue {
          valueSlider(
            "Hue",
            value: $configuration.hue,
            range: 0...360,
            formattedValue: "\(Int(configuration.hue.rounded()))°"
          )
        }

        Toggle("Override tone", isOn: $configuration.overridesTone)
        if configuration.overridesTone {
          valueSlider(
            "Tone",
            value: $configuration.tone,
            range: 0...1,
            formattedValue: configuration.tone.formatted(.number.precision(.fractionLength(2)))
          )
        }

        Toggle("Use example palette override", isOn: $configuration.usesPaletteOverride)
        Toggle("Normalize seed", isOn: $configuration.normalize)
        Toggle("Correct generated contrast", isOn: $configuration.contrast)
      }
      .padding(.vertical, 8)
    }
  }

  private var fixedNames: some View {
    GroupBox("Fixed names") {
      VStack(alignment: .leading, spacing: 12) {
        Text("The Claude and Codex names are shared with the Flutter Studio.")
          .font(.caption)
          .foregroundStyle(.secondary)
        HStack(spacing: 16) {
          ForEach(StudioConfiguration.fixedNames, id: \.self) { name in
            Button {
              configuration.name = name
            } label: {
              VStack(spacing: 8) {
                Blobatar(
                  name: name,
                  size: 82,
                  options: BlobatarOptions(background: .circle),
                  accessibilityLabel: "\(name) Blobatar"
                )
                Text(name)
              }
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Use \(name) as the preview seed")
          }
        }
      }
      .padding(.vertical, 8)
    }
  }

  private var crowd: some View {
    GroupBox("Crowd check") {
      VStack(alignment: .leading, spacing: 14) {
        Text("Twelve fixed names rendered with the current public options.")
          .font(.caption)
          .foregroundStyle(.secondary)
        LazyVGrid(columns: columns, spacing: 18) {
          ForEach(StudioConfiguration.crowdNames, id: \.self) { name in
            VStack(spacing: 7) {
              Blobatar(
                name: name,
                size: 78,
                options: configuration.options,
                accessibilityLabel: "\(name) Blobatar"
              )
              Text(name)
                .font(.caption)
                .lineLimit(1)
            }
          }
        }
      }
      .padding(.vertical, 8)
    }
  }

  private var displayName: String {
    configuration.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      ? "Empty seed"
      : configuration.name
  }

  private func pickerRow<Selection: Hashable, Content: View>(
    _ title: String,
    selection: Binding<Selection>,
    @ViewBuilder content: () -> Content
  ) -> some View {
    HStack {
      Text(title)
      Spacer()
      Picker(title, selection: selection, content: content)
        .labelsHidden()
        .pickerStyle(.menu)
    }
  }

  private func valueSlider(
    _ title: String,
    value: Binding<Double>,
    range: ClosedRange<Double>,
    formattedValue: String
  ) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text(title)
        Spacer()
        Text(formattedValue)
          .foregroundStyle(.secondary)
          .monospacedDigit()
      }
      Slider(value: value, in: range)
    }
  }
}
