# Phase 5 — Blobatar Studio

Status: accepted
Date: 2026-09-07
Reference: Blobatar `2.4.0`, generation 2

Phase 5 adds an iOS and macOS SwiftUI integration application under
`Examples/BlobatarStudio`. Its shared Xcode app target produces a native bundle
for both platforms and resolves the repository-root package exactly as an
external application does. A sibling Swift package compiles the same sources
as the independent test harness. The executable imports only `BlobatarCore`,
`BlobatarSwiftUI`, Foundation, and SwiftUI; it cannot reach
implementation-only library declarations.

## Controls and population checks

The main preview exposes name editing, every authored shape and expression,
all backdrop modes, optional hue and tone overrides, a complete example
palette override, normalization, and generated-palette contrast correction.
Shape selection demonstrates a pinned public trait. Eye-gap selection
demonstrates deterministic narrowed candidate sets.

A twelve-name adaptive grid reapplies the current options to a population for
visual checks. Selecting the fixed Claude or Codex cards moves that exact name
into the main preview. Those names remain aligned with the Flutter Studio,
while Swift deliberately renders the public Blobatar figure instead of
duplicating Flutter's example-only custom mark painters.

## Motion staging

Static, hover, and always-on choices are modeled as Studio activity policy.
Hover is active only while the pointer is over the preview, always-on is active
continuously, and the system Reduced Motion preference cuts either mode to the
static endpoint. The status beside the preview makes that effective state
observable.

Phase 5 does not invent temporary animation arithmetic. Until Phase 6 adds the
public `AnimatedBlobatar` and reference-backed elapsed-time frames, all three
modes display the exact static expression endpoint. Keeping this distinction
explicit prevents the example from becoming a second motion implementation
that could drift from the core.

## Verification boundary

Studio tests resolve only through public core values. They prove full option
forwarding, all ten pinned shapes, narrowed-trait selection, name re-entry
determinism, Reduced Motion policy, and the fixed-name and crowd catalogs. The
nested package builds independently on macOS and its app scheme builds for a
generic iOS destination with signing disabled.

This phase changes no generation logic, TypeScript or Flutter source, or
reference fixture. It does not change the generation-2 seed-to-look mapping.
