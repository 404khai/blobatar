import BlobatarCore
import SwiftUI

/// Displays a Blobatar with deterministic, elapsed-time generation-2 motion.
///
/// Geometry is resolved and converted once per request. Timeline ticks only
/// update affine transforms and the two expression-tinted fills.
public struct AnimatedBlobatar: View {
  public let name: String
  public let size: CGFloat?
  public let options: BlobatarOptions
  public let animation: BlobatarAnimation
  public let active: Bool
  public let respectsReducedMotion: Bool
  public let accessibilityLabel: String?

  private let rendering: BlobatarAnimatedRendering
  private let requestKey: BlobatarRequestKey

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.scenePhase) private var scenePhase
  @StateObject private var driver: BlobatarAnimationDriver
  @State private var hovered = false
  @State private var refreshToken = UUID()

  public init(
    name: String,
    size: CGFloat? = nil,
    options: BlobatarOptions = BlobatarOptions(),
    animation: BlobatarAnimation = .hover,
    active: Bool = true,
    respectsReducedMotion: Bool = true,
    accessibilityLabel: String? = nil
  ) {
    self.name = name
    self.size = size.map { max(0, $0) }
    self.options = options
    self.animation = animation
    self.active = active
    self.respectsReducedMotion = respectsReducedMotion
    self.accessibilityLabel = accessibilityLabel
    let rendering = BlobatarAnimatedRenderCache.shared.rendering(for: name, options: options)
    self.rendering = rendering
    requestKey = BlobatarRequestKey(name: name, options: options)
    _driver = StateObject(
      wrappedValue: BlobatarAnimationDriver(
        rendering: rendering,
        expression: options.expression,
        mode: animation
      )
    )
  }

  public var body: some View {
    Group {
      if isEffectivelyActive {
        TimelineView(
          .animation(
            minimumInterval: 1.0 / 60.0,
            paused: !driver.needsContinuousFrames(at: monotonicMilliseconds())
          )
        ) { _ in
          Canvas(opaque: false, rendersAsynchronously: false) { context, canvasSize in
            var context = context
            driver.rendering.plan.draw(
              frame: driver.frame(at: monotonicMilliseconds()),
              in: &context,
              size: canvasSize
            )
          }
        }
      } else {
        Blobatar(name: name, options: options)
      }
    }
    .frame(
      maxWidth: size == nil ? .infinity : nil,
      maxHeight: size == nil ? .infinity : nil
    )
    .frame(width: size, height: size)
    .contentShape(Rectangle())
    .onHover { next in
      hovered = next
      synchronize()
    }
    .onAppear(perform: synchronize)
    .onChange(of: requestKey) { _ in synchronize() }
    .onChange(of: animation) { _ in synchronize() }
    .onChange(of: active) { _ in synchronize() }
    .onChange(of: reduceMotion) { _ in synchronize() }
    .onChange(of: scenePhase) { _ in synchronize() }
    .accessibilityElement(children: .ignore)
    .accessibilityAddTraits(.isImage)
    .modifier(
      AnimatedBlobatarAccessibilityModifier(
        label: accessibilityLabel
      )
    )
  }

  private var isEffectivelyActive: Bool {
    blobatarAnimationIsActive(
      explicitlyActive: active,
      scenePhase: scenePhase,
      reduceMotion: reduceMotion,
      respectsReducedMotion: respectsReducedMotion
    )
  }

  @MainActor
  private func synchronize() {
    let now = monotonicMilliseconds()
    driver.updateRequest(
      rendering: rendering,
      expression: options.expression,
      animate: isEffectivelyActive,
      now: now
    )
    driver.updateActivity(
      active: isEffectivelyActive,
      mode: animation,
      hovered: hovered,
      now: now
    )
    scheduleFinalRefresh(after: 0.45)
  }

  @MainActor
  private func scheduleFinalRefresh(after seconds: Double) {
    let token = UUID()
    refreshToken = token
    Task { @MainActor in
      try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
      guard refreshToken == token else { return }
      refreshToken = UUID()
    }
  }
}

func blobatarAnimationIsActive(
  explicitlyActive: Bool,
  scenePhase: ScenePhase,
  reduceMotion: Bool,
  respectsReducedMotion: Bool
) -> Bool {
  explicitlyActive
    && scenePhase == .active
    && !(respectsReducedMotion && reduceMotion)
}

private struct AnimatedBlobatarAccessibilityModifier: ViewModifier {
  let label: String?

  @ViewBuilder
  func body(content: Content) -> some View {
    if let label {
      content.accessibilityLabel(Text(label))
    } else {
      content
    }
  }
}
