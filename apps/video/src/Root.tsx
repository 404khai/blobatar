import type { FC } from "react";
import { Composition } from "remotion";
import { Launch } from "./Launch";
import { END, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: FC = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={END}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
