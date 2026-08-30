import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('always mode advances seeded ambient motion', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(
          child: AnimatedBlobatar(
            name: 'alain',
            size: 100,
            animation: BlobatarAnimation.always,
          ),
        ),
      ),
    );
    final AnimatedBlobatarPainter painter = _painter(tester);
    final AnimatedBlobatarFrame first = painter.currentFrame;
    expect(first.amplitude, 1);

    await tester.pump(const Duration(milliseconds: 137));
    final AnimatedBlobatarFrame next = _painter(tester).currentFrame;
    expect(next.motion.breathe, isNot(first.motion.breathe));
    expect(next.motion.bob, isNot(first.motion.bob));
  });

  testWidgets('hover mode ramps in and out with pointer interaction',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(
          child: AnimatedBlobatar(name: 'ada', size: 100),
        ),
      ),
    );
    expect(_painter(tester).currentFrame.amplitude, 0);

    final TestGesture mouse =
        await tester.createGesture(kind: ui.PointerDeviceKind.mouse);
    await mouse.addPointer(
      location: tester.getCenter(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is CustomPaint &&
              widget.painter is AnimatedBlobatarPainter,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_painter(tester).currentFrame.amplitude, closeTo(1, 1e-6));
    expect(_painter(tester).currentFrame.hover, closeTo(1, 1e-6));

    await mouse.moveTo(const ui.Offset(1, 1));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_painter(tester).currentFrame.amplitude, closeTo(0, 1e-6));
    expect(_painter(tester).currentFrame.hover, closeTo(0, 1e-6));
    await mouse.removePointer();
  });

  testWidgets('expression changes morph and preserve interruption continuity',
      (tester) async {
    final GlobalKey<_HarnessState> key = GlobalKey<_HarnessState>();
    await tester.pumpWidget(MaterialApp(home: _Harness(key: key)));

    final AnimatedBlobatarRenderer renderer = _painter(tester).renderer;
    key.currentState!.setExpression(core.happy);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 150));
    final AnimatedBlobatarFrame halfwayFrame = _painter(tester).currentFrame;
    final double progress = core.expressionEnterEase(0.5);
    final core.Pose halfway = halfwayFrame.pose;
    _expectPoseClose(
      halfway,
      core.lerpPose(core.idle.pose, core.happy.pose, progress),
    );
    final core.Palette idlePalette = renderer.paletteFor(core.idle);
    final core.Palette happyPalette = renderer.paletteFor(core.happy);
    expect(
      halfwayFrame.headColor,
      _uiColor(
        core.fadeHex(
          idlePalette[core.colorHead]!,
          happyPalette[core.colorHead]!,
          progress,
        ),
      ),
    );
    expect(
      halfwayFrame.eyeColor,
      _uiColor(
        core.fadeHex(
          idlePalette[core.colorEye]!,
          happyPalette[core.colorEye]!,
          progress,
        ),
      ),
    );
    expect(_painter(tester).renderer, same(renderer));

    key.currentState!.setExpression(core.sad);
    await tester.pump();
    final AnimatedBlobatarFrame interrupted = _painter(tester).currentFrame;
    _expectPoseClose(interrupted.pose, halfway);
    expect(interrupted.headColor, halfwayFrame.headColor);
    expect(interrupted.eyeColor, halfwayFrame.eyeColor);

    await tester.pump(const Duration(milliseconds: 300));
    expect(_painter(tester).currentFrame.pose, core.sad.pose);

    key.currentState!.setExpression(core.idle);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(_painter(tester).currentFrame.pose, core.identityPose);
  });

  testWidgets('unrelated rebuilds reuse the resolved renderer', (tester) async {
    final GlobalKey<_HarnessState> key = GlobalKey<_HarnessState>();
    await tester.pumpWidget(MaterialApp(home: _Harness(key: key)));
    final AnimatedBlobatarRenderer before = _painter(tester).renderer;

    key.currentState!.changeLabel();
    await tester.pump();
    expect(_painter(tester).renderer, same(before));

    key.currentState!.changeName();
    await tester.pump();
    expect(_painter(tester).renderer, isNot(same(before)));
  });

  testWidgets('reduced motion and inactive widgets use the static path',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: AnimatedBlobatar(
            name: 'alain',
            size: 80,
            animation: BlobatarAnimation.always,
            options: core.BlobatarOptions(expression: core.thinking),
          ),
        ),
      ),
    );
    expect(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is CustomPaint && widget.painter is BlobatarPainter,
        ),
        findsOneWidget);
    expect(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is CustomPaint &&
              widget.painter is AnimatedBlobatarPainter,
        ),
        findsNothing);

    await tester.pumpWidget(
      const MaterialApp(
        home: AnimatedBlobatar(
          name: 'alain',
          size: 80,
          active: false,
          animation: BlobatarAnimation.always,
        ),
      ),
    );
    expect(
        find.byWidgetPredicate(
          (Widget widget) =>
              widget is CustomPaint && widget.painter is BlobatarPainter,
        ),
        findsOneWidget);
  });

  testWidgets('TickerMode pauses callbacks and disposal removes them',
      (tester) async {
    final TestWidgetsFlutterBinding binding =
        TestWidgetsFlutterBinding.instance;
    await tester.pumpWidget(
      const MaterialApp(
        home: TickerMode(
          enabled: false,
          child: AnimatedBlobatar(
            name: 'alain',
            size: 80,
            animation: BlobatarAnimation.always,
          ),
        ),
      ),
    );
    expect(binding.transientCallbackCount, 0);

    await tester.pumpWidget(
      const MaterialApp(
        home: AnimatedBlobatar(
          name: 'alain',
          size: 80,
          animation: BlobatarAnimation.always,
        ),
      ),
    );
    expect(binding.transientCallbackCount, greaterThan(0));

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    expect(binding.transientCallbackCount, 0);
    expect(tester.takeException(), isNull);
  });
}

AnimatedBlobatarPainter _painter(WidgetTester tester) {
  final CustomPaint paint = tester.widget<CustomPaint>(
    find.byWidgetPredicate(
      (Widget widget) =>
          widget is CustomPaint && widget.painter is AnimatedBlobatarPainter,
    ),
  );
  return paint.painter! as AnimatedBlobatarPainter;
}

ui.Color _uiColor(String hex) => ui.Color(
      int.parse(hex.substring(1), radix: 16) | 0xff000000,
    );

void _expectPoseClose(core.Pose actual, core.Pose expected) {
  final Map<String, double> a = actual.toJson();
  final Map<String, double> b = expected.toJson();
  for (final String key in a.keys) {
    expect(a[key], closeTo(b[key]!, 1e-9), reason: key);
  }
}

class _Harness extends StatefulWidget {
  const _Harness({super.key});

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  String name = 'alain';
  String label = 'Alain';
  core.Expression expression = core.idle;

  void setExpression(core.Expression value) =>
      setState(() => expression = value);

  void changeLabel() => setState(() => label = 'Avatar of Alain');

  void changeName() => setState(() => name = 'ada');

  @override
  Widget build(BuildContext context) {
    return Center(
      child: AnimatedBlobatar(
        name: name,
        size: 100,
        semanticLabel: label,
        animation: BlobatarAnimation.always,
        options: core.BlobatarOptions(expression: expression),
      ),
    );
  }
}
