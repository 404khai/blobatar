# Blobatar for Swift and SwiftUI

This directory contains the native Swift port of Blobatar. The package is in
Phase 1: its Swift Package Manager products, shared parity harness, and module
seams exist; deterministic rendering is implemented in the phases that follow.

## Products

- `BlobatarCore` owns the UI-independent generation-2 calculation.
- `BlobatarSwiftUI` will provide the static and animated SwiftUI views.

The public package manifest lives at the repository root because consumers add
this repository by Git URL. All Swift-specific source and tests remain here.

## Contract

The port implements the frozen Blobatar `2.4.0` generation-2 seed-to-look
contract. Its canonical reference artifact is
[`../../fixtures/blobatar-v2.4.0.json`](../../fixtures/blobatar-v2.4.0.json),
exported only from the pinned TypeScript implementation by
[`../../tools/export-reference-vectors.ts`](../../tools/export-reference-vectors.ts).

The Swift artifact is byte-identical to the Flutter workstream's copy. The
Swift harness checks that equality whenever both are present, without changing
or depending on Flutter production code. Neither port regenerates expected
output from itself.

## Requirements

- Swift 6.0 or later
- iOS 15 or later
- macOS 12 or later

## Development

From the repository root:

```sh
swift build --build-tests
swift test
swift run --package-path packages/swift/Tests/Consumer BlobatarConsumerSmoke
```

The consumer smoke package resolves this repository through its public SwiftPM
products, catching a manifest that builds internally but cannot be imported by
an application.
