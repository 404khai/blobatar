# Phase 0 — coordination and contract freeze record

Status: recorded, pending maintainer answers on the open items  
Date: 2026-08-28  
Issue: [Alain00/blobatar#29](https://github.com/Alain00/blobatar/issues/29)  
Coordination comment:
[issue #29 comment](https://github.com/Alain00/blobatar/issues/29#issuecomment-5458106206)

This document records what Phase 0 settled, what the issue thread settled, and
what stays open before Phase 1 adds Dart code. It corrects one stale claim in
[the plan](../flutter-port-plan.md): the issue is no longer commentless. The
thread now contains two other ports, a maintainer ruling, and a published
reference-vector schema.

## What the issue thread settled

The thread grew after this plan was written. In order:

1. **Rart3001** opened the issue announcing a completed native port
   ([Rart3001/blobatar_flutter](https://github.com/Rart3001/blobatar_flutter)),
   with a 714-assertion parity suite pinned to `2.4.0`, the package name
   `blobatar_flutter`, and two declared deviations: approximated NFC
   normalization and the unported secondary-eye saccade wrap.
2. **404khai** (this fork) had already commented that a Dart port was underway.
3. **The maintainer (Alain00)** ruled:
   - A Dart port is a reimplementation, not an adapter, so turbo, `bun test`,
     and `release.yml` cannot own it. **It lives in its own repo**, publishes to
     pub.dev, and does not open a PR against this monorepo.
   - Rart3001 may take `blobatar` on pub.dev with the parity suite in CI pinned
     to a release, a community-port README line, and the maintainer added as an
     uploader; `blobatar_flutter` is the acceptable fallback.
   - What the maintainer wants **in this repo** is the reference vectors as a
     published artifact, so every port shares one definition of correct.
   - The NFC approximation deserves a known-limitations note (the paste-a-name
     case); the saccade eye-wrap is not worth porting.
4. **404khai** stepped back for Rart3001's implementation, keeping the fork
   port for a Flutter manga reader app.
5. **rk54rk** surfaced a third port
   ([rk54rk/flutter_blobatar](https://github.com/rk54rk/flutter_blobatar)) and
   set it private in favor of Rart3001's.
6. **Rart3001** shared the port's reference-vector schema publicly, reported a
   cross-platform finding (Dart VM `cos`/`sin` differ by one ULP between Linux
   and macOS on some inputs, affecting 10 of 349 geometry cases), and resolved
   it with a documented tight relative tolerance for layout geometry while
   palette and pose stay exact.

## Decisions recorded by this phase

| Item | Decision | Status |
| --- | --- | --- |
| Port location | The fork, `404khai/blobatar`, branch `feat/flutter-dart-port`. No port PR against this monorepo. | Settled by the maintainer's ruling. |
| Reference version | Blobatar `2.4.0`, generation 2. Vectors pin that release. | Proposed in the coordination comment; confirmed unless the maintainer objects. |
| Gaze layer (new in `2.6.0`) | Pointer-driven, has a JavaScript half, and is outside the frozen gen-2 seed-to-look contract. Out of port scope; noted as a documented non-goal. | Proposed; open to maintainer override. |
| Vector schema | Converge on the schema Rart3001 published, refined in [`reference-vectors.md`](./reference-vectors.md), so the ecosystem keeps one definition of correct. | Proposed; awaiting the maintainer's file-shape decision. |
| Package name | Not self-assigned. The coordination comment asks the maintainer to confirm which name, if any, this port may use. Nothing publishes until answered. | Open. |
| SDK range | Current stable Dart/Flutter at Phase 1 start, widened only as far as CI can actually test. Exact floor recorded in the Phase 1 `pubspec.yaml`. | Open, to be fixed in Phase 1. |
| License | MIT, matching upstream, with attribution to the original author. | Proposed. |
| First PR target | No port PR targets this monorepo. The only upstream-facing PR candidate is the reference-vector artifact itself, once the maintainer confirms its shape. | Settled by the maintainer's ruling. |

## Open parity questions

These are open questions with required tests and documentation, not accepted
deviations. Each must resolve into either a faithful implementation or a
documented, tested deviation before its phase exits.

### NFC normalization

Dart has no built-in Unicode normalization. The JavaScript core normalizes with
`String.prototype.normalize("NFC")`, and the maintainer flagged the paste-a-name
case as the one that matters. Candidate resolutions for Phase 1:

- Port or vendor an NFC implementation (for example through the `unorm_dart`
  package) and prove it against reference vectors containing precomposed,
  decomposed, and mixed Latin.
- If vendoring is rejected, document the approximation with concrete
  before/after seeds from the vector fixture.

The choice is a Phase 1 gate, not a given. The plan's rule stands: no
undocumented parity deviation.

### Secondary-eye saccade wrap

The maintainer's "wouldn't bother with" call was made about Rart3001's port.
The coordination comment asks whether the same call applies here. Until
answered, this port treats the wrap as an open parity question due in Phase 4:
either express it faithfully or document and test the exact deviation.

### Cross-platform trigonometric tolerance

Rart3001's finding means bit-exact geometry equality across engines is not
achievable in Dart: `dart:math`'s `cos`/`sin` call the host C library and IEEE
754 does not mandate one implementation. The port adopts the same resolution in
principle, with the exact comparison rule written into the vector fixture
(per-case rule: exact for hash, traits, palette, and pose; documented tight
relative tolerance for trig-derived layout numbers only). See
[`reference-vectors.md`](./reference-vectors.md).

## Exit criteria check

- [x] Maintainer-facing scope and package-name decision raised in the issue
      discussion (the coordination comment).
- [x] Reference version and vector schema written down before Dart code
      ([`reference-vectors.md`](./reference-vectors.md)).
- [ ] Maintainer answers on package name, vector file shape, and the two
      parity calls above. Blocking publication and the upstream vector-artifact
      PR, not blocking Phase 1 development in the fork.

