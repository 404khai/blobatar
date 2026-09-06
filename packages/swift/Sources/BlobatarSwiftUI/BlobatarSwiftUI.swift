import BlobatarCore

// The SwiftUI rendering module deliberately starts with no public surface.
// Phase 3 adds the static Blobatar view after the deterministic core exists.
// This internal bridge makes the Phase 1 link from presentation to core
// observable without freezing a placeholder public type.
enum PresentationContract {
  static let referenceVersion = BlobatarContract.referenceVersion
  static let generation = BlobatarContract.generation
}
