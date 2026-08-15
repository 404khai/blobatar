/**
 * A minimal CDP client — enough to open a page and run async code in it.
 *
 * The alternative, `--virtual-time-budget --dump-dom`, is simpler and cannot
 * answer timing questions: virtual time advances timers but not the document
 * timeline, so animations report `startTime: null` and a transition can be
 * proven to *exist* but never watched to *run*. Watching one run is the whole
 * point of a morph, so the probe pays for a real clock.
 */

export interface Session {
  eval<T>(expr: string): Promise<T>;
  close(): Promise<void>;
}

export async function launch(chrome: string, url: string): Promise<Session> {
  const proc = Bun.spawn(
    [
      chrome,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=800,800",
      "--remote-debugging-port=0",
      // Headless throttles rAF and animation frames in hidden pages; without
      // these a transition simply never advances between samples.
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      url,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  // Chrome prints the endpoint to stderr once, then keeps the stream open.
  const reader = proc.stderr.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let ws = "";
  while (!ws) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`chrome exited before listening:\n${buf}`);
    buf += dec.decode(value, { stream: true });
    ws = buf.match(/ws:\/\/\S+/)?.[0] ?? "";
  }
  reader.releaseLock();

  // What Chrome prints is the *browser* endpoint, which has no `Runtime`
  // domain. The page target is discovered through the HTTP list on the same
  // host, polled because the tab may not be registered the instant the browser
  // starts listening.
  const host = new URL(ws).host;
  let page = "";
  for (let i = 0; i < 100 && !page; i++) {
    const list = (await (await fetch(`http://${host}/json/list`)).json()) as {
      type: string;
      url: string;
      webSocketDebuggerUrl?: string;
    }[];
    page =
      list.find((t) => t.type === "page" && t.webSocketDebuggerUrl)
        ?.webSocketDebuggerUrl ?? "";
    if (!page) await Bun.sleep(50);
  }
  if (!page) throw new Error("chrome exposed no page target");

  const sock = new WebSocket(page);
  await new Promise((res, rej) => {
    sock.onopen = res;
    sock.onerror = rej;
  });

  let next = 0;
  const pending = new Map<
    number,
    { res: (v: unknown) => void; rej: (e: Error) => void }
  >();
  sock.onmessage = (e) => {
    const msg = JSON.parse(String(e.data));
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
  };

  const send = (method: string, params: unknown = {}) =>
    new Promise<any>((res, rej) => {
      const id = ++next;
      pending.set(id, { res, rej });
      sock.send(JSON.stringify({ id, method, params }));
    });

  return {
    async eval<T>(expr: string) {
      const r = await send("Runtime.evaluate", {
        expression: expr,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails)
        throw new Error(
          r.exceptionDetails.exception?.description ??
            JSON.stringify(r.exceptionDetails),
        );
      return r.result.value as T;
    },
    async close() {
      sock.close();
      proc.kill();
      await proc.exited;
    },
  };
}
