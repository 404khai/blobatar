import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';

void main() {
  final TestWidgetsFlutterBinding binding =
      TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('renders a name at a pinned size', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(child: Blobatar(name: 'alain', size: 48)),
      ),
    );
    final Finder figure = find.byWidgetPredicate(
      (Widget w) => w is CustomPaint && w.painter is BlobatarPainter,
    );
    expect(figure, findsOneWidget);
    final Size layout = tester.getSize(figure);
    expect(layout.width, 48);
    expect(layout.height, 48);
  });

  testWidgets('repaints when name or options change and not otherwise',
      (tester) async {
    expect(binding, isNotNull);
    // Exercise the painter's shouldRepaint contract directly.
    final BlobatarPainter a =
        BlobatarPainter(name: 'alain', options: const core.BlobatarOptions());
    final BlobatarPainter same =
        BlobatarPainter(name: 'alain', options: const core.BlobatarOptions());
    final BlobatarPainter otherName =
        BlobatarPainter(name: 'bob', options: const core.BlobatarOptions());
    final BlobatarPainter otherHue = BlobatarPainter(
        name: 'alain', options: const core.BlobatarOptions(hue: 200));
    final BlobatarPainter otherBg = BlobatarPainter(
        name: 'alain',
        options: const core.BlobatarOptions(background: core.Backdrop.square));

    expect(a.shouldRepaint(same), isFalse, reason: 'identical config');
    expect(a.shouldRepaint(otherName), isTrue, reason: 'name change');
    expect(a.shouldRepaint(otherHue), isTrue, reason: 'hue change');
    expect(a.shouldRepaint(otherBg), isTrue, reason: 'background change');
  });

  testWidgets('option forwarding reaches the renderer exactly', (tester) async {
    final core.BlobatarOptions opts = core.BlobatarOptions(
      hue: 210,
      tone: 0.5,
      normalize: false,
      traits: const {'shape': 0.99},
      background: core.Backdrop.squircle,
    );
    final BlobatarPainter painter =
        BlobatarPainter(name: 'alain', options: opts);
    expect(painter.renderer.options, same(opts));
    expect(painter.renderer.hasBackdrop, isTrue);
    // The renderer resolved the same options: the squircle backdrop must be
    // present (hasBackdrop) and the layout must reflect the pinned shape.
    final core.BlobatarLayout layout = core.layoutFor('alain', opts);
    expect(layout.shape, 'triangle');
  });

  testWidgets('semantics: semanticLabel sets an image semantic',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(
          child: Blobatar(
              name: 'alain', size: 32, semanticLabel: 'Avatar of Alain'),
        ),
      ),
    );
    final Finder sem = find.bySemanticsLabel('Avatar of Alain');
    expect(sem, findsOneWidget);
  });
}
