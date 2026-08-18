import type { FC } from "react";
import { Composition } from "remotion";
import { Endpoint } from "./Endpoint";
import { Expressions } from "./Expressions";
import { Launch } from "./Launch";
import { END, FPS, HEIGHT, WIDTH } from "./timeline";
import { END as REEL_END } from "./reel";
import { END as EP_END } from "./url";

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
  </>
);
