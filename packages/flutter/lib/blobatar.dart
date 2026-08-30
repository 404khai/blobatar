/// Deterministic geometric blobatars from any string — the pure Dart port of
/// the blobatar generation-2 engine.
///
/// The same name always produces the same output within the frozen gen-2
/// contract. The numeric ranges in `styles/compose.dart`, the bands in
/// `styles/blob.dart`, and the tone set are all part of that contract.
///
/// This package is independent of Flutter: the deterministic core (hash,
/// traits, OKLCh palette, layout geometry) is usable from any Dart program.
/// The Flutter widget and painter arrive in a later port phase and will not be
/// a dependency of this library's core.
///
/// Parity: the fixture in `test/fixtures/reference-vectors.json` was exported
/// once from the TypeScript implementation at blobatar `2.4.0` and is the
/// definition of correct this port is checked against. See
/// `docs/flutter-port/reference-vectors.md` in the repository.
library;

export 'src/color.dart'
    show
        Oklch,
        Palette,
        colorBg,
        colorHead,
        colorEye,
        contrast,
        ensureContrast,
        toHex,
        fromHex,
        mix,
        mixHex,
        fadeHex,
        Tint,
        hot,
        rose,
        blush,
        bile,
        tints,
        tinted,
        floors,
        darkSurface,
        surfaceFloor,
        ramp,
        palette;
export 'src/hash.dart' show normalizeSeed, seedState, stream, imul, toInt32;
export 'src/expression.dart'
    show
        Pose,
        Expression,
        identityPose,
        idle,
        happy,
        sad,
        mad,
        surprised,
        wink,
        sleepy,
        smug,
        unsure,
        scared,
        love,
        shy,
        sick,
        thinking,
        expressions,
        bakePose,
        expressionPalette;
export 'src/render.dart'
    show
        Backdrop,
        BackdropGeometry,
        BlobatarOptions,
        Resolved,
        backdropFor,
        layoutFor,
        partsFor,
        resolve;
export 'src/shape.dart'
    show
        BlobPath,
        PathSegment,
        MoveTo,
        LineTo,
        CubicTo,
        QuadTo,
        HorizontalLineTo,
        VerticalLineTo,
        ClosePath,
        Superellipse,
        Polygon,
        superellipse,
        arc,
        blobPath,
        polygon,
        box,
        taper;
export 'src/styles/blob.dart' show bands, style;
export 'src/styles/compose.dart'
    show Band, BlobatarLayout, BlobatarStyle, Eye, faceFit;
export 'src/styles/shapes.dart'
    show
        Body,
        Deco,
        Ellipse,
        Petal,
        Shape,
        round,
        organic,
        boxy,
        capsule,
        nub,
        cloud,
        droplet,
        hexagon,
        sun,
        triangle;
export 'src/traits.dart' show Traits, TraitOverrides, traitsFor;

/// The version this port tracks for parity.
const String parityVersion = '2.4.0';
