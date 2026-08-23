/**
 * What `packages/harness` cannot tell you.
 *
 * The harness renders `@blobatar/react-native` through a stub, because
 * `react-native`'s entry is Flow-typed source Bun cannot parse. That proves the
 * adapter chooses the right props and draws the same figure React draws, and
 * it proves nothing at all about whether `react-native-svg` puts pixels on a
 * screen when handed them. ADR-0009 records that this repo has shipped an
 * adapter rendering an empty string twice, each time with a clean typecheck and
 * a green suite, so the gap is not hypothetical.
 *
 * This app is the answer to it, and it is deliberately run by hand. There is no
 * `check` script worth writing here: an emulator in CI would test the emulator.
 *
 * ```sh
 * cd apps/example-native
 * bun start          # then press i, a, or scan the QR code with Expo Go
 * ```
 *
 * Three things here exist for reasons that are not obvious from this file, and
 * each was found by the app failing rather than by reasoning:
 *
 * - `metro.config.js` deduplicates React. Without it the adapter loads a second
 *   copy from its own `node_modules` and every hook reads a null dispatcher.
 *   Its header has the whole account.
 * - `typescript` is declared at 5.x, because Expo's CLI reads the project
 *   tsconfig through the TypeScript API and crashes on the 7 the rest of the
 *   workspace is on.
 * - `packages/react-native` pins its type-only `react-native` devDependency to
 *   the version this app uses, because a floating range there resolves higher
 *   and hands Metro mismatched React Native internals.
 *
 * None of the three is a consumer's problem. All three exist because this app
 * lives inside the workspace that builds the adapter.
 *
 * What to look for, in the order the screens are laid out:
 *
 * 1. **The grid.** Ten silhouettes, one per band, each with the shape trait
 *    pinned. If a shape is missing or draws as a blank square, the mark for it
 *    is not reaching an element.
 * 2. **Backdrops.** The plate must sit *behind* the figure and must not lean
 *    or scale with it.
 * 3. **Poses.** `happy` shifts the body upward. If the posed row sits at the
 *    same height as the idle one, the `transform` is being dropped; if it sits
 *    at a different height than the same pose on the web, it is being applied
 *    twice.
 * 4. **The tinted pose.** `mad` recolours the head and leaves the eyes alone.
 * 5. **The morph.** It cycles through the roster on its own, so this one shows
 *    itself. Every channel has to move together over the same 300ms. If the
 *    eyes travel and the body snaps, or the tint arrives instantly while the
 *    eyes ease, a channel is being applied outside the interpolation. Returning
 *    to idle is deliberately slower than adopting a pose, which is the one
 *    difference to watch for rather than to correct.
 *    Then tap two poses in quick succession, which stops the loop: the second
 *    morph must start from where the face is, not from the pose the first set
 *    out from.
 *
 * Everything written on this screen is drawn in a colour derived from the
 * device theme. It is not decoration. React Native gives `<Text>` no colour of
 * its own, so this app's first release was entirely unreadable on a dark-mode
 * phone, controls included. See `useInk`.
 */

import { useEffect, useState, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Blobatar, MorphingBlobatar } from "@blobatar/react-native";
import {
  happy,
  mad,
  sad,
  sleepy,
  surprised,
  thinking,
  wink,
  type Expression,
} from "blobatar/expression";

/**
 * Colours for the chrome around the blobatars, in whichever theme the device is
 * in.
 *
 * React Native gives `<Text>` no colour of its own, so an unstyled label is
 * black, and this app spent its first release with every heading, caption and
 * control invisible on a dark-mode phone. Nothing was wrong with the blobatars,
 * which carry their own backdrops and were the only thing on screen: the labels
 * were being drawn in black on black. That is worth a hook rather than a
 * constant, because a device switching theme while the app is open should not
 * be the thing that hides the controls again.
 *
 * The blobatars themselves are untouched by this. Their palette comes from the
 * seed and is the library's business; nothing here may tint one.
 */
function useInk() {
  const dark = useColorScheme() === "dark";
  return {
    fg: dark ? "#f4f4f5" : "#111113",
    chip: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
    chipOn: dark ? "rgba(255,255,255,0.34)" : "rgba(0,0,0,0.18)",
  };
}

const SHAPES: [string, number][] = [
  ["round", 0.11],
  ["organic", 0.35],
  ["boxy", 0.54],
  ["capsule", 0.65],
  ["nub", 0.745],
  ["cloud", 0.825],
  ["droplet", 0.888],
  ["hexagon", 0.933],
  ["sun", 0.965],
  ["triangle", 0.99],
];

/**
 * The morph, which is the one thing on this screen a still screenshot cannot
 * check. Deliberately large: at 64pt the eye channels are a couple of points of
 * travel and a dropped one is invisible.
 */
const MORPHS: [string, Expression | undefined][] = [
  ["idle", undefined],
  ["happy", happy],
  ["sad", sad],
  ["mad", mad],
  ["surprised", surprised],
  ["wink", wink],
  ["sleepy", sleepy],
  ["thinking", thinking],
];

/**
 * How long each pose is held while the loop is running.
 *
 * Longer than the morph itself on purpose. At 400ms back to idle, anything
 * under about a second runs the next morph into the tail of the last one, and
 * every pose is then seen mid-travel and never settled, which makes the loop
 * useless for the one thing it is for: judging whether a pose *arrives*
 * correctly. Interrupting is worth watching too, which is what tapping is for.
 */
const HOLD = 1400;

function Morph() {
  const ink = useInk();
  const [i, setI] = useState(0);
  // Running by default, because the morph is the only thing on this screen a
  // still frame cannot show, and a device check that needs a tap before it
  // shows anything is a device check somebody skips.
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setI(n => (n + 1) % MORPHS.length), HOLD);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: ink.fg }]}>
        The morph: it cycles on its own, and tapping a pose takes over
      </Text>
      <View style={styles.morph}>
        <MorphingBlobatar
          name="alain00"
          size={160}
          background="squircle"
          expression={MORPHS[i]![1]}
          title={`alain00, ${MORPHS[i]![0]}`}
        />
      </View>
      <View style={styles.row}>
        <Pressable
          onPress={() => setPlaying(p => !p)}
          style={[styles.chip, { backgroundColor: playing ? ink.chipOn : ink.chip }]}
        >
          <Text style={[styles.chipText, { color: ink.fg }]}>
            {playing ? "pause" : "play"}
          </Text>
        </Pressable>
        {MORPHS.map(([name], n) => (
          <Pressable
            key={name}
            // Tapping is also how you stop the loop, rather than through a
            // separate control: reaching for a pose while it cycles means you
            // want that pose, and having it advance out from under you a second
            // later is the loop fighting the person using it.
            onPress={() => {
              setPlaying(false);
              setI(n);
            }}
            style={[
              styles.chip,
              { backgroundColor: n === i && !playing ? ink.chipOn : ink.chip },
            ]}
          >
            <Text style={[styles.chipText, { color: ink.fg }]}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const ink = useInk();
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: ink.fg }]}>{title}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

/** A label under a blobatar, in a colour the device can actually show. */
function Caption({ children }: { children: ReactNode }) {
  const ink = useInk();
  return <Text style={[styles.caption, { color: ink.fg }]}>{children}</Text>;
}

export default function App() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <StatusBar style="auto" />

      <Section title="Every silhouette in gen2">
        {SHAPES.map(([name, v]) => (
          <View key={name} style={styles.cell}>
            <Blobatar name="alain00" size={64} traits={{ shape: v }} />
            <Caption>{name}</Caption>
          </View>
        ))}
      </Section>

      <Section title="Backdrops: the plate sits behind, and does not move with the figure">
        {(["square", "circle", "squircle"] as const).map(bg => (
          <View key={bg} style={styles.cell}>
            <Blobatar name="alain00" size={64} background={bg} />
            <Caption>{bg}</Caption>
          </View>
        ))}
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background={false} />
          <Caption>none</Caption>
        </View>
      </Section>

      <Section title="Poses: happy lifts the body, mad tints the head only">
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" />
          <Caption>idle</Caption>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" expression={happy} />
          <Caption>happy</Caption>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" expression={mad} />
          <Caption>mad</Caption>
        </View>
      </Section>

      <Morph />

      <Section title="A crowd: every name a different creature">
        {Array.from({ length: 24 }, (_, i) => (
          <Blobatar key={i} name={`user-${i}`} size={44} title={`user-${i}`} />
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 64, gap: 28 },
  section: { gap: 10 },
  heading: { fontSize: 13, fontWeight: "600", opacity: 0.6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" },
  cell: { alignItems: "center", gap: 4 },
  caption: { fontSize: 11, opacity: 0.5 },
  morph: { alignItems: "center", paddingVertical: 8 },
  // No colours here. Every one of them depends on the device's theme and is
  // set at the element, which is what `useInk` is for.
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 12 },
});
