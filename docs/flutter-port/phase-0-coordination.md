# Phase 0 — coordination and contract freeze record

Status: recorded — decisions superseded where noted below  
Date: 2026-08-28  
Issue: [Alain00/blobatar#29](https://github.com/Alain00/blobatar/issues/29)

This document records what Phase 0 settled, what the issue thread settled, and
what stays open. The coordination comment this phase posted on issue #29 was
later removed; the decisions that matter stand or fall on their own and are
noted below.

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
| Port location | The fork, `404khai/blobatar`, at `packages/flutter`. This is the fork's official SDK: developed here, published to pub.dev as `blobatar`, and offered upstream to `Alain00/blobatar` once complete. | Revised decision — supersedes the maintainer's "lives in its own repo" ruling for this port. |
| Reference version | Blobatar `2.4.0`, generation 2. Vectors pin that release. | Settled; the fixture is generated from a v2.4.0 checkout. |
| Gaze layer (new in `2.6.0`) | Pointer-driven, has a JavaScript half, and is outside the frozen gen-2 seed-to-look contract. Out of port scope; noted as a documented non-goal. | Proposed; open to maintainer override. |
| Vector schema | The fixture and schema in [`reference-vectors.md`](./reference-vectors.md), generated only by `tools/export-reference-vectors.ts` from the pinned release. | In use since Phase 1. |
| Package name | `blobatar` on pub.dev, with the maintainer consulted before publishing (`blobatar_flutter` was the fallback). | To be confirmed before publication. |
| SDK range | Current stable Dart/Flutter at Phase 1 start (`sdk: ^3.6.0`), widened only as far as CI can actually test. | Recorded in the Phase 1 `pubspec.yaml`. |
| License | MIT, matching upstream, with attribution to the original author. | Proposed. |
| First PR target | Phased PRs target this repository's `main`; the finished SDK is offered upstream once the maintainer approves. | Revised decision. |

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
      discussion. (The coordination comment has since been removed; the open
      questions remain on issue #29.)
- [x] Reference version and vector schema written down before Dart code
      ([`reference-vectors.md`](./reference-vectors.md)).
- [ ] Maintainer answers on package name and the two parity calls. Blocking
      publication and the upstream hand-off, not blocking Phase 1 in this
      repository.

