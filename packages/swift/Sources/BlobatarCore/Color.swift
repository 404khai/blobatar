import Foundation

struct Oklch: Sendable, Equatable, Hashable {
  let lightness: Double
  let chroma: Double
  let hue: Double

  func withLightness(_ lightness: Double) -> Oklch {
    Oklch(lightness: lightness, chroma: chroma, hue: hue)
  }
}

private struct LinearRGB {
  let red: Double
  let green: Double
  let blue: Double
}

private func linearRGB(_ color: Oklch) -> LinearRGB {
  let radians = color.hue * .pi / 180
  let a = color.chroma * cos(radians)
  let b = color.chroma * sin(radians)
  let light = color.lightness

  let lPrime = light + 0.396_337_777_4 * a + 0.215_803_757_3 * b
  let mPrime = light - 0.105_561_345_8 * a - 0.063_854_172_8 * b
  let sPrime = light - 0.089_484_177_5 * a - 1.291_485_548 * b

  let l = lPrime * lPrime * lPrime
  let m = mPrime * mPrime * mPrime
  let s = sPrime * sPrime * sPrime

  return LinearRGB(
    red: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    green: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    blue: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s
  )
}

private func isInGamut(_ color: LinearRGB) -> Bool {
  color.red >= -0.0001 && color.red <= 1.0001
    && color.green >= -0.0001 && color.green <= 1.0001
    && color.blue >= -0.0001 && color.blue <= 1.0001
}

private func resolvedRGB(_ color: Oklch) -> LinearRGB {
  var rgb = linearRGB(color)
  if !isInGamut(rgb) {
    var low = 0.0
    var high = color.chroma
    for _ in 0..<12 {
      let middle = (low + high) / 2
      let candidate = linearRGB(
        Oklch(lightness: color.lightness, chroma: middle, hue: color.hue)
      )
      if isInGamut(candidate) {
        low = middle
      } else {
        high = middle
      }
    }
    rgb = linearRGB(Oklch(lightness: color.lightness, chroma: low, hue: color.hue))
  }
  return LinearRGB(
    red: min(1, max(0, rgb.red)),
    green: min(1, max(0, rgb.green)),
    blue: min(1, max(0, rgb.blue))
  )
}

private func luminance(_ color: Oklch) -> Double {
  let rgb = resolvedRGB(color)
  return 0.2126 * rgb.red + 0.7152 * rgb.green + 0.0722 * rgb.blue
}

func contrast(_ first: Oklch, _ second: Oklch) -> Double {
  let x = luminance(first)
  let y = luminance(second)
  return (max(x, y) + 0.05) / (min(x, y) + 0.05)
}

func ensureContrast(_ foreground: Oklch, against background: Oklch, minimum: Double) -> Oklch {
  if contrast(foreground, background) >= minimum { return foreground }

  let lean = foreground.lightness >= background.lightness ? 1.0 : -1.0
  for direction in [lean, -lean] {
    var lightness = foreground.lightness
    for _ in 0..<60 {
      lightness = min(1, max(0, lightness + direction * 0.02))
      let candidate = foreground.withLightness(lightness)
      if contrast(candidate, background) >= minimum { return candidate }
      if lightness == 0 || lightness == 1 { break }
    }
  }

  let black = Oklch(lightness: 0, chroma: 0, hue: foreground.hue)
  let white = Oklch(lightness: 1, chroma: 0, hue: foreground.hue)
  return contrast(black, background) >= contrast(white, background) ? black : white
}

private func hexByte(_ value: Int) -> String {
  let encoded = String(value, radix: 16)
  return value < 16 ? "0\(encoded)" : encoded
}

func toHex(_ color: Oklch) -> String {
  let rgb = resolvedRGB(color)
  let channels = [rgb.red, rgb.green, rgb.blue].map { value -> Int in
    let encoded =
      value <= 0.003_130_8
      ? 12.92 * value
      : 1.055 * pow(value, 1 / 2.4) - 0.055
    return Int(floor(encoded * 255 + 0.5))
  }
  return "#\(hexByte(channels[0]))\(hexByte(channels[1]))\(hexByte(channels[2]))"
}

private struct Tone {
  let edge: Double
  let lightness: Double
  let chroma: Double
}

private let tones = [
  Tone(edge: 0.2, lightness: 0.86, chroma: 0.085),
  Tone(edge: 0.36, lightness: 0.9, chroma: 0.028),
  Tone(edge: 0.62, lightness: 0.73, chroma: 0.135),
  Tone(edge: 0.8, lightness: 0.62, chroma: 0.165),
  Tone(edge: 0.93, lightness: 0.87, chroma: 0.16),
  Tone(edge: 1, lightness: 0.34, chroma: 0.035),
]

let darkSurface = Oklch(lightness: 0.145, chroma: 0, hue: 0)
let surfaceContrastFloor = 1.5

func makeRamp(hue: Double, tone: Double, enforceContrast: Bool) -> [String: Oklch] {
  let selected = tones.first(where: { tone < $0.edge }) ?? tones[0]
  let body = ensureContrast(
    Oklch(lightness: selected.lightness, chroma: selected.chroma, hue: hue),
    against: darkSurface,
    minimum: surfaceContrastFloor
  )
  var ramp = [
    "bg": Oklch(lightness: 0.965, chroma: 0.01, hue: hue),
    "head": body,
    "eye":
      body.lightness >= 0.5
      ? Oklch(lightness: 0.17, chroma: 0.02, hue: hue)
      : Oklch(lightness: 0.97, chroma: 0.012, hue: hue),
  ]
  if enforceContrast {
    ramp["head"] = ensureContrast(ramp["head"]!, against: ramp["bg"]!, minimum: 1.25)
    ramp["eye"] = ensureContrast(ramp["eye"]!, against: ramp["head"]!, minimum: 4.5)
  }
  return ramp
}

func makePalette(hue: Double, tone: Double, enforceContrast: Bool) -> BlobatarPalette {
  let ramp = makeRamp(hue: hue, tone: tone, enforceContrast: enforceContrast)
  return BlobatarPalette(
    background: toHex(ramp["bg"]!),
    head: toHex(ramp["head"]!),
    eye: toHex(ramp["eye"]!)
  )
}
