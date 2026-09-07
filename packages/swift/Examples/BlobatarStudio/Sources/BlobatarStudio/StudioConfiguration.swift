import BlobatarCore
import Foundation

enum StudioShape: String, CaseIterable, Identifiable {
  case automatic = "Auto"
  case round = "Round"
  case organic = "Organic"
  case boxy = "Boxy"
  case capsule = "Capsule"
  case nub = "Nub"
  case cloud = "Cloud"
  case droplet = "Droplet"
  case hexagon = "Hexagon"
  case sun = "Sun"
  case triangle = "Triangle"

  var id: Self { self }

  var pinnedValue: Double? {
    switch self {
    case .automatic: nil
    case .round: 0.11
    case .organic: 0.35
    case .boxy: 0.54
    case .capsule: 0.65
    case .nub: 0.745
    case .cloud: 0.825
    case .droplet: 0.888
    case .hexagon: 0.933
    case .sun: 0.965
    case .triangle: 0.99
    }
  }
}

enum StudioEyeGap: String, CaseIterable, Identifiable {
  case automatic = "Auto"
  case compact = "Compact set"
  case varied = "Varied set"
  case wide = "Wide set"

  var id: Self { self }

  var narrowedValues: [Double]? {
    switch self {
    case .automatic: nil
    case .compact: [0.08, 0.18, 0.28]
    case .varied: [0.12, 0.5, 0.88]
    case .wide: [0.72, 0.84, 0.96]
    }
  }
}

enum StudioMotionMode: String, CaseIterable, Identifiable {
  case staticPreview = "Static"
  case hover = "Hover"
  case always = "Always on"

  var id: Self { self }

  func isActive(isHovered: Bool, reduceMotion: Bool) -> Bool {
    guard !reduceMotion else { return false }
    switch self {
    case .staticPreview: return false
    case .hover: return isHovered
    case .always: return true
    }
  }
}

struct StudioConfiguration {
  static let crowdNames = [
    "Ada",
    "Grace Hopper",
    "Linus",
    "Margaret Hamilton",
    "Alan Turing",
    "Katherine Johnson",
    "Guido",
    "Matz",
    "Tim Berners-Lee",
    "Brendan Eich",
    "Hedy Lamarr",
    "James Gosling",
  ]

  var name = "alain00"
  var shape = StudioShape.automatic
  var expression = BlobatarExpression.idle
  var backdrop = BlobatarBackdrop.none
  var eyeGap = StudioEyeGap.automatic
  var motion = StudioMotionMode.staticPreview
  var overridesHue = false
  var hue = 225.0
  var overridesTone = false
  var tone = 0.5
  var usesPaletteOverride = false
  var normalize = true
  var contrast = true

  var options: BlobatarOptions {
    var traits: [String: BlobatarTraitOverride] = [:]
    if let pinnedValue = shape.pinnedValue {
      traits["shape"] = .pinned(pinnedValue)
    }
    if let narrowedValues = eyeGap.narrowedValues {
      traits["eye.gap"] = .narrowed(narrowedValues)
    }

    return BlobatarOptions(
      palette: usesPaletteOverride
        ? BlobatarPaletteOverride(
          background: "#d9e4ff",
          head: "#315c9b",
          eye: "#ffffff"
        )
        : nil,
      hue: overridesHue ? hue : nil,
      tone: overridesTone ? tone : nil,
      traits: traits,
      normalize: normalize,
      contrast: contrast,
      background: backdrop,
      expression: expression
    )
  }
}
