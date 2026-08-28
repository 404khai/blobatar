import type { FC } from "react";
import { Composition } from "remotion";
import { Endpoint } from "./Endpoint";
import { Expressions } from "./Expressions";
import { Launch } from "./Launch";
import { END, FPS, HEIGHT, WIDTH } from "./timeline";
import { END as REEL_END } from "./reel";
import { END as EP_END } from "./url";
import { Triangles, END as TRI_END } from "./Triangles";
import { Adapters } from "./Adapters";
import { END as SWAP_END } from "./swap";
import { Thanks } from "./Thanks";
import { Gaze } from "./Gaze";
import { END as STARS_END } from "./stars";
import { END as WATCH_END } from "./watch";

export const RemotionRoot: FC = () => (
  <>
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* The expressions announce. Same stage, same clock, same creature. */}
    <Composition
      id="Expressions"
      component={Expressions}
      durationInFrames={REEL_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/*
      The endpoint announce. Same stage, and deliberately no clock: what the URL
      returns is a static document, so this is the one composition with nothing
      seeking underneath it.
    */}
    <Composition
      id="Endpoint"
      component={Endpoint}
      durationInFrames={EP_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/*
      The triangles cut. One shape, one pose, one move — and the only
      composition here that is light, because it is texture rather than an
      announcement and half the tone set vanishes on ink.
    */}
    <Composition
      id="Triangles"
      component={Triangles}
      durationInFrames={TRI_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/*
      The adapters announce. One import specifier is edited and the creature
      above it does not change — because the frame hands over to a real Vue app
      on the commit, and the two adapters render the same bytes.
    */}
    <Composition
      id="Adapters"
      component={Adapters}
      durationInFrames={SWAP_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/*
      The gaze announce. Same stage, same crowd, same creature, and the camera
      makes the same move the launch film makes, so the two cut together. What
      is different is that the thing being demonstrated is not on screen: the
      pointer is, and the claim is what a hundred and twenty pairs of eyes do
      about it.

      Under §4.8 an eye is a mark on a sphere rather than a sticker on a disc,
      and that is the register of the whole film rather than a moment in it. The
      close shot turns the hero 49° on every frame it is on screen, so the
      foreshortening, the per-eye differential and the convergence tilt are what
      the pursuit is drawn with. The old translate could not have held that: at
      this excursion it slid both eyes off the face, which is the failure the
      projection exists to make impossible. See `travelAt`.

      The pull back stops halfway for the same argument's other half. The head
      an eye turns on is fitted to its own silhouette, anywhere from 0.98 of the
      box on a round face to 0.39 on a triangle, and neither of the shots this
      film used to have could show that: one head up close proves nothing about
      nine, and at 124px an outline is a smudge. So the camera pauses on a 3x3
      block of nine different shapes, all tracking one pointer, each turning as
      far as its own head allows. See `SHOWCASE`.
    */}
    <Composition
      id="Gaze"
      component={Gaze}
      durationInFrames={WATCH_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/*
      The thank-you. The only composition whose crowd is not a list of names
      chosen to make a point — it is the stargazers, and the camera is fitted to
      them rather than authored, so the shot re-cuts itself if the list moves.
    */}
    <Composition
      id="Thanks"
      component={Thanks}
      durationInFrames={STARS_END}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
