import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';
import 'package:blobatar_example/main.dart';
import 'package:blobatar_example/web_seed_marks.dart';

void main() {
  test('web seed aliases resolve to their matching marks', () {
    expect(webSeedMarkFor(' Claude '), WebSeedMark.claude);
    expect(webSeedMarkFor('anthropic'), WebSeedMark.claude);
    expect(webSeedMarkFor('CODEX'), WebSeedMark.codex);
    expect(webSeedMarkFor('openai'), WebSeedMark.codex);
    expect(webSeedMarkFor('ada'), isNull);
  });

  testWidgets('seed, shape, and expression update the large preview', (
    WidgetTester tester,
  ) async {
    await _pumpStudio(tester);

    await tester.enterText(
      find.byKey(const ValueKey<String>('seed-input')),
      'ada',
    );
    await tester.pump();

    Blobatar preview = tester.widget<Blobatar>(
      find.byKey(const ValueKey<String>('preview-blobatar')),
    );
    expect(preview.name, 'ada');

    await tester.tap(find.byKey(const ValueKey<String>('shape-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('triangle').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey<String>('expression-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('thinking').last);
    await tester.pumpAndSettle();

    preview = tester.widget<Blobatar>(
      find.byKey(const ValueKey<String>('preview-blobatar')),
    );
    expect(preview.options.traits, <String, Object>{'shape': 0.99});
    expect(preview.options.expression, core.thinking);
    expect(find.text('triangle · thinking'), findsOneWidget);
  });

  testWidgets('Claude and Codex presets replace and lock the preview', (
    WidgetTester tester,
  ) async {
    await _pumpStudio(tester);

    await tester.enterText(
      find.byKey(const ValueKey<String>('seed-input')),
      'claude',
    );
    await tester.pump();

    expect(
      find.byKey(const ValueKey<String>('preview-special-mark')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('preview-blobatar')),
      findsNothing,
    );
    expect(
      tester
          .widget<DropdownButtonFormField<dynamic>>(
            find.byKey(const ValueKey<String>('shape-picker')),
          )
          .onChanged,
      isNull,
    );
    expect(
      tester
          .widget<DropdownButtonFormField<dynamic>>(
            find.byKey(const ValueKey<String>('expression-picker')),
          )
          .onChanged,
      isNull,
    );

    final Finder codexButton = find.byKey(const ValueKey<String>('use-codex'));
    await tester.ensureVisible(codexButton);
    await tester.tap(codexButton);
    await tester.pumpAndSettle();

    expect(find.text('Codex web preset · locked'), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey<String>('seed-input')))
          .controller!
          .text,
      'codex',
    );
  });
}

Future<void> _pumpStudio(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1200, 1100);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(const BlobatarExampleApp());
  await tester.pumpAndSettle();
}
