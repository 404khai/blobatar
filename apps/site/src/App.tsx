import { Hero } from "@/components/Hero";
import { WallSection } from "@/components/WallSection";
import { Chat } from "@/components/Chat";
import { Close } from "@/components/Close";

export function App() {
  return (
    <main>
      <Hero />
      <WallSection />
      {/*
        After the wall, and the order is the argument: the wall claims the
        blobatars are all different, the chat shows what that difference is
        *for*. Reversed, the chat is a screenshot of an app you have no reason
        to care about yet.
      */}
      <Chat />
      <Close />
    </main>
  );
}
