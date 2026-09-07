# Blobatar Studio

Blobatar Studio is the iOS and macOS integration example for the Swift SDK. It
is a separate Swift package so its executable target can import only the
public `BlobatarCore` and `BlobatarSwiftUI` products.

Open `BlobatarStudio.xcodeproj` in Xcode and run the shared `BlobatarStudio`
scheme for My Mac or an iOS simulator. The project produces a real application
bundle on both platforms and resolves the repository root as a local Swift
package dependency.

The sibling `Package.swift` compiles the same sources as an external-consumer
harness and owns the integration tests. From the repository root, run:

```sh
swift test --package-path packages/swift/Examples/BlobatarStudio
```

The motion selector demonstrates static, pointer-hover, always-on, and system
Reduced Motion activity policy. The avatar remains on the exact static
expression endpoint until Phase 6 adds deterministic elapsed-time frames to
the public SwiftUI module.
