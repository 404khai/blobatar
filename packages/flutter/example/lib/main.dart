import 'package:flutter/material.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';

import 'web_seed_marks.dart';

void main() => runApp(const BlobatarExampleApp());

const List<_ShapeOption> _shapes = [
  _ShapeOption('auto', null),
  _ShapeOption('round', 0.11),
  _ShapeOption('organic', 0.35),
  _ShapeOption('boxy', 0.54),
  _ShapeOption('capsule', 0.65),
  _ShapeOption('nub', 0.745),
  _ShapeOption('cloud', 0.825),
  _ShapeOption('droplet', 0.888),
  _ShapeOption('hexagon', 0.933),
  _ShapeOption('sun', 0.965),
  _ShapeOption('triangle', 0.99),
];

class _ShapeOption {
  final String name;
  final double? at;

  const _ShapeOption(this.name, this.at);
}

class BlobatarExampleApp extends StatelessWidget {
  const BlobatarExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Blobatar studio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff6657d9),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xfff7f7fb),
        useMaterial3: true,
      ),
      home: const BlobatarStudioPage(),
    );
  }
}

class BlobatarStudioPage extends StatefulWidget {
  const BlobatarStudioPage({super.key});

  @override
  State<BlobatarStudioPage> createState() => _BlobatarStudioPageState();
}

class _BlobatarStudioPageState extends State<BlobatarStudioPage> {
  final TextEditingController _nameController = TextEditingController(
    text: 'alain00',
  );
  String _name = 'alain00';
  _ShapeOption _shape = _shapes.first;
  core.Expression _expression = core.idle;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _usePreset(String name) {
    _nameController.text = name;
    _nameController.selection = TextSelection.collapsed(offset: name.length);
    setState(() => _name = name);
  }

  @override
  Widget build(BuildContext context) {
    final WebSeedMark? mark = webSeedMarkFor(_name);
    final bool locked = mark != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Blobatar studio')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 920),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Deterministic geometric avatars from any string.',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 6),
                Text(
                  'Change the seed, silhouette, and expression to preview the '
                  'same output your Flutter app will render.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                LayoutBuilder(
                  builder: (BuildContext context, BoxConstraints constraints) {
                    final Widget preview = _Preview(
                      name: _name,
                      shape: _shape,
                      expression: _expression,
                      mark: mark,
                    );
                    final Widget controls = _Controls(
                      controller: _nameController,
                      shape: _shape,
                      expression: _expression,
                      locked: locked,
                      onNameChanged: (String value) =>
                          setState(() => _name = value),
                      onShapeChanged: (_ShapeOption value) =>
                          setState(() => _shape = value),
                      onExpressionChanged: (core.Expression value) =>
                          setState(() => _expression = value),
                    );

                    if (constraints.maxWidth >= 720) {
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: preview),
                          const SizedBox(width: 24),
                          Expanded(child: controls),
                        ],
                      );
                    }
                    return Column(
                      children: [preview, const SizedBox(height: 20), controls],
                    );
                  },
                ),
                const SizedBox(height: 28),
                Text(
                  'Web seed easter eggs',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'These example-only marks mirror blobatar.dev. Their shape '
                  'and expression are intentionally locked.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 14,
                  runSpacing: 14,
                  children: [
                    _PresetCard(
                      name: 'Claude',
                      seed: 'claude',
                      mark: WebSeedMark.claude,
                      onSelected: _usePreset,
                    ),
                    _PresetCard(
                      name: 'Codex',
                      seed: 'codex',
                      mark: WebSeedMark.codex,
                      onSelected: _usePreset,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Preview extends StatelessWidget {
  final String name;
  final _ShapeOption shape;
  final core.Expression expression;
  final WebSeedMark? mark;

  const _Preview({
    required this.name,
    required this.shape,
    required this.expression,
    required this.mark,
  });

  @override
  Widget build(BuildContext context) {
    final WebSeedMark? currentMark = mark;
    final Widget avatar = currentMark == null
        ? Blobatar(
            key: const ValueKey<String>('preview-blobatar'),
            name: name,
            size: 250,
            semanticLabel: '$name blobatar',
            options: core.BlobatarOptions(
              background: core.Backdrop.squircle,
              expression: expression,
              traits: shape.at == null
                  ? null
                  : <String, Object>{'shape': shape.at!},
            ),
          )
        : WebSeedMarkView(
            key: const ValueKey<String>('preview-special-mark'),
            mark: currentMark,
            size: 250,
            semanticLabel: '${currentMark.label} mark',
          );

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            avatar,
            const SizedBox(height: 16),
            Text(
              name.trim().isEmpty ? 'empty seed' : name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              currentMark == null
                  ? '${shape.name} · ${expression.name}'
                  : '${currentMark.label} web preset · locked',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  final TextEditingController controller;
  final _ShapeOption shape;
  final core.Expression expression;
  final bool locked;
  final ValueChanged<String> onNameChanged;
  final ValueChanged<_ShapeOption> onShapeChanged;
  final ValueChanged<core.Expression> onExpressionChanged;

  const _Controls({
    required this.controller,
    required this.shape,
    required this.expression,
    required this.locked,
    required this.onNameChanged,
    required this.onShapeChanged,
    required this.onExpressionChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const ValueKey<String>('seed-input'),
              controller: controller,
              onChanged: onNameChanged,
              decoration: const InputDecoration(
                labelText: 'Seed name',
                hintText: 'Type any name',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<_ShapeOption>(
              key: const ValueKey<String>('shape-picker'),
              initialValue: shape,
              decoration: const InputDecoration(
                labelText: 'Shape',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final _ShapeOption option in _shapes)
                  DropdownMenuItem<_ShapeOption>(
                    value: option,
                    child: Text(option.name),
                  ),
              ],
              onChanged: locked
                  ? null
                  : (_ShapeOption? value) {
                      if (value != null) onShapeChanged(value);
                    },
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<core.Expression>(
              key: const ValueKey<String>('expression-picker'),
              initialValue: expression,
              decoration: const InputDecoration(
                labelText: 'Expression',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final core.Expression option in core.expressions)
                  DropdownMenuItem<core.Expression>(
                    value: option,
                    child: Text(option.name),
                  ),
              ],
              onChanged: locked
                  ? null
                  : (core.Expression? value) {
                      if (value != null) onExpressionChanged(value);
                    },
            ),
            if (locked) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(
                    Icons.lock_outline,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Web presets do not expose shape or expression controls.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PresetCard extends StatelessWidget {
  final String name;
  final String seed;
  final WebSeedMark mark;
  final ValueChanged<String> onSelected;

  const _PresetCard({
    required this.name,
    required this.seed,
    required this.mark,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              WebSeedMarkView(
                mark: mark,
                size: 104,
                semanticLabel: '$name mark',
              ),
              const SizedBox(height: 10),
              Text(name, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 2),
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline, size: 14),
                  SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      'shape + expression locked',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.tonal(
                key: ValueKey<String>('use-$seed'),
                onPressed: () => onSelected(seed),
                child: const Text('Use seed'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
