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

const List<double> _hues = [12, 40, 78, 140, 190, 225, 275, 320];

const List<String> _galleryNames = [
  'Ada',
  'Grace Hopper',
  'Linus',
  'Margaret Hamilton',
  'Alan Turing',
  'Katherine Johnson',
  'Guido',
  'Matz',
  'Tim Berners-Lee',
  'Brendan Eich',
  'Hedy Lamarr',
  'James Gosling',
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
  double? _hue;
  core.Backdrop _background = core.Backdrop.none;

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

  Future<void> _pickAppearance() async {
    final _AppearanceSelection? selection =
        await showModalBottomSheet<_AppearanceSelection>(
          context: context,
          isScrollControlled: true,
          showDragHandle: true,
          useSafeArea: true,
          constraints: const BoxConstraints(maxWidth: 680),
          builder: (BuildContext context) => _AppearanceSheet(
            name: _name,
            initialShape: _shape,
            initialExpression: _expression,
            hue: _hue,
          ),
        );
    if (selection == null || !mounted) return;
    setState(() {
      _shape = selection.shape;
      _expression = selection.expression;
    });
  }

  @override
  Widget build(BuildContext context) {
    final WebSeedMark? mark = webSeedMarkFor(_name);
    final bool locked = mark != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Blobatar Studio')),
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
                      hue: _hue,
                      background: _background,
                      mark: mark,
                    );
                    final Widget controls = _Controls(
                      controller: _nameController,
                      shape: _shape,
                      expression: _expression,
                      hue: _hue,
                      background: _background,
                      locked: locked,
                      onNameChanged: (String value) =>
                          setState(() => _name = value),
                      onHueChanged: (double? value) =>
                          setState(() => _hue = value),
                      onBackgroundChanged: (core.Backdrop value) =>
                          setState(() => _background = value),
                      onAppearancePressed: _pickAppearance,
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
                  'Seeded gallery',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  'Twelve fixed names, always rendered as the same blobatars.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 14),
                const Center(child: _SeededGallery()),
                const SizedBox(height: 28),
                Text(
                  'Blobatar easter eggs',
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
  final double? hue;
  final core.Backdrop background;
  final WebSeedMark? mark;

  const _Preview({
    required this.name,
    required this.shape,
    required this.expression,
    required this.hue,
    required this.background,
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
              background: background,
              hue: hue,
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

    return Padding(
      key: const ValueKey<String>('preview-surface'),
      padding: const EdgeInsets.symmetric(vertical: 12),
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
    );
  }
}

class _Controls extends StatelessWidget {
  final TextEditingController controller;
  final _ShapeOption shape;
  final core.Expression expression;
  final double? hue;
  final core.Backdrop background;
  final bool locked;
  final ValueChanged<String> onNameChanged;
  final ValueChanged<double?> onHueChanged;
  final ValueChanged<core.Backdrop> onBackgroundChanged;
  final VoidCallback onAppearancePressed;

  const _Controls({
    required this.controller,
    required this.shape,
    required this.expression,
    required this.hue,
    required this.background,
    required this.locked,
    required this.onNameChanged,
    required this.onHueChanged,
    required this.onBackgroundChanged,
    required this.onAppearancePressed,
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
            OutlinedButton(
              key: const ValueKey<String>('appearance-picker'),
              onPressed: locked ? null : onAppearancePressed,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                alignment: Alignment.centerLeft,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.tune),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Shape & expression'),
                        const SizedBox(height: 2),
                        Text(
                          '${shape.name} · ${expression.name}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_up),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const _ControlLabel('Background'),
            const SizedBox(height: 8),
            _BackgroundPicker(
              value: background,
              enabled: !locked,
              onChanged: onBackgroundChanged,
            ),
            const SizedBox(height: 22),
            const _ControlLabel('Hue'),
            const SizedBox(height: 8),
            _HuePicker(value: hue, enabled: !locked, onChanged: onHueChanged),
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
                      'Web presets do not expose appearance controls.',
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

class _ControlLabel extends StatelessWidget {
  final String text;

  const _ControlLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toLowerCase(),
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        letterSpacing: 0.4,
      ),
    );
  }
}

class _BackgroundPicker extends StatelessWidget {
  final core.Backdrop value;
  final bool enabled;
  final ValueChanged<core.Backdrop> onChanged;

  const _BackgroundPicker({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<core.Backdrop>(
      key: const ValueKey<String>('background-picker'),
      segments: const [
        ButtonSegment(value: core.Backdrop.none, label: Text('none')),
        ButtonSegment(value: core.Backdrop.squircle, label: Text('squircle')),
        ButtonSegment(value: core.Backdrop.circle, label: Text('circle')),
        ButtonSegment(value: core.Backdrop.square, label: Text('square')),
      ],
      selected: <core.Backdrop>{value},
      showSelectedIcon: false,
      expandedInsets: EdgeInsets.zero,
      onSelectionChanged: enabled
          ? (Set<core.Backdrop> selected) => onChanged(selected.single)
          : null,
    );
  }
}

class _HuePicker extends StatelessWidget {
  final double? value;
  final bool enabled;
  final ValueChanged<double?> onChanged;

  const _HuePicker({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          ChoiceChip(
            key: const ValueKey<String>('hue-auto'),
            label: const Text('auto'),
            selected: value == null,
            onSelected: enabled ? (_) => onChanged(null) : null,
          ),
          for (final double hue in _hues)
            Semantics(
              button: true,
              selected: value == hue,
              label: 'Hue ${hue.round()} degrees',
              child: InkWell(
                key: ValueKey<String>('hue-${hue.round()}'),
                customBorder: const CircleBorder(),
                onTap: enabled ? () => onChanged(hue) : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 34,
                  height: 34,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: value == hue
                        ? Border.all(
                            color: Theme.of(context).colorScheme.onSurface,
                            width: 2,
                          )
                        : null,
                  ),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _hueColor(hue),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

Color _hueColor(double hue) {
  final String hex = core.toHex(core.Oklch(0.72, 0.15, hue));
  return Color(int.parse(hex.substring(1), radix: 16) | 0xff000000);
}

class _AppearanceSelection {
  final _ShapeOption shape;
  final core.Expression expression;

  const _AppearanceSelection(this.shape, this.expression);
}

class _AppearanceSheet extends StatefulWidget {
  final String name;
  final _ShapeOption initialShape;
  final core.Expression initialExpression;
  final double? hue;

  const _AppearanceSheet({
    required this.name,
    required this.initialShape,
    required this.initialExpression,
    required this.hue,
  });

  @override
  State<_AppearanceSheet> createState() => _AppearanceSheetState();
}

class _AppearanceSheetState extends State<_AppearanceSheet> {
  late _ShapeOption _shape = widget.initialShape;
  late core.Expression _expression = widget.initialExpression;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: 0.9,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Shape & expression',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                FilledButton(
                  key: const ValueKey<String>('appearance-done'),
                  onPressed: () => Navigator.of(
                    context,
                  ).pop(_AppearanceSelection(_shape, _expression)),
                  child: const Text('Done'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _ControlLabel('Shape'),
                  const SizedBox(height: 8),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _shapes.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 4,
                          mainAxisSpacing: 6,
                          crossAxisSpacing: 6,
                          childAspectRatio: 0.82,
                        ),
                    itemBuilder: (BuildContext context, int index) {
                      final _ShapeOption option = _shapes[index];
                      return _AvatarOptionTile(
                        key: ValueKey<String>('shape-${option.name}'),
                        name: widget.name,
                        label: option.name,
                        selected: option == _shape,
                        options: core.BlobatarOptions(
                          background: core.Backdrop.circle,
                          hue: widget.hue,
                          expression: _expression,
                          traits: option.at == null
                              ? null
                              : <String, Object>{'shape': option.at!},
                        ),
                        onTap: () => setState(() => _shape = option),
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  const _ControlLabel('Expression'),
                  const SizedBox(height: 8),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: core.expressions.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 4,
                          mainAxisSpacing: 6,
                          crossAxisSpacing: 6,
                          childAspectRatio: 0.82,
                        ),
                    itemBuilder: (BuildContext context, int index) {
                      final core.Expression option = core.expressions[index];
                      return _AvatarOptionTile(
                        key: ValueKey<String>('expression-${option.name}'),
                        name: widget.name,
                        label: option.name,
                        selected: option == _expression,
                        options: core.BlobatarOptions(
                          background: core.Backdrop.circle,
                          hue: widget.hue,
                          expression: option,
                          traits: _shape.at == null
                              ? null
                              : <String, Object>{'shape': _shape.at!},
                        ),
                        onTap: () => setState(() => _expression = option),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarOptionTile extends StatelessWidget {
  final String name;
  final String label;
  final bool selected;
  final core.BlobatarOptions options;
  final VoidCallback onTap;

  const _AvatarOptionTile({
    super.key,
    required this.name,
    required this.label,
    required this.selected,
    required this.options,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? Theme.of(context).colorScheme.surfaceContainerHighest
          : Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 3),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Blobatar(
                name: name.isEmpty ? ' ' : name,
                size: 54,
                options: options,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeededGallery extends StatelessWidget {
  const _SeededGallery();

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 620),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: _galleryNames.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 18,
          crossAxisSpacing: 12,
          childAspectRatio: 1.15,
        ),
        itemBuilder: (BuildContext context, int index) {
          final String name = _galleryNames[index];
          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Blobatar(
                key: ValueKey<String>('gallery-avatar-$index'),
                name: name,
                size: 74,
                semanticLabel: '$name blobatar',
                options: const core.BlobatarOptions(
                  background: core.Backdrop.circle,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        },
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
