import BlobatarCore
import BlobatarSwiftUI

precondition(BlobatarContract.referenceVersion == "2.4.0")
precondition(BlobatarContract.generation == "gen2")

let drawing = resolveBlobatar(
  "alain",
  options: BlobatarOptions(
    palette: BlobatarPaletteOverride(head: "#112233"),
    traits: ["shape": .pinned(0.99)],
    background: .square
  )
)
precondition(drawing.silhouette == .triangle)
precondition(drawing.palette.head == "#112233")
precondition(drawing.eyes.count == 2)
precondition(drawing.backdrop != nil)

let view = Blobatar(
  name: "alain",
  size: 64,
  options: BlobatarOptions(background: .square, expression: .happy),
  accessibilityLabel: "Avatar of Alain"
)
precondition(view.name == "alain")
precondition(view.size == 64)

print(
  "Blobatar Swift consumer resolved and presented a generation-2 \(drawing.silhouette.rawValue)")
