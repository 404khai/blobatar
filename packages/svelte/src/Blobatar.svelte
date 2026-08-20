<script lang="ts">
  import { _parts } from "blobatar/internal";
  import { blobatarUri } from "blobatar/uri";
  import type { Animate, BlobatarOptions } from "blobatar/internal";

  type StaticProps = { animate?: false };

  type AnimatedProps = { animate: Animate };

  let {
    name: seed,
    size,
    background,
    palette,
    hue,
    tone,
    normalize,
    contrast,
    title,
    animate,
    expression,
    traits,
    class: className,
    style: styleAttr,
    ...rest
  }: {
    name: string;
    class?: string;
    style?: string;
  } & BlobatarOptions &
    (StaticProps | AnimatedProps) = $props();

  let opts = $derived({
    size,
    background,
    palette,
    hue,
    tone,
    normalize,
    contrast,
    title,
    expression,
    traits,
  });

  let isAnimated = $derived(!!animate);

  let src = $derived(isAnimated ? "" : blobatarUri(seed, opts));

  let parts = $derived(
    isAnimated
      ? _parts(seed, { ...opts, animate: animate === "always" ? "always" : "hover" })
      : null,
  );

  let html = $derived(parts?.inner ?? "");
</script>

{#if parts}
  {@const vars = parts.vars ?? {}}
  {@const styleStr = styleAttr
    ? Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";") + ";" + styleAttr
    : Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width={size}
    height={size}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    class={className}
    style={styleStr}
    {...rest}
  >
    {#if title}
      <title>{title}</title>
    {/if}
    {#if parts.bg}
      <path d={parts.bg.d} fill={parts.bg.fill} />
    {/if}
    <g class={parts.cls}>
      {@html html}
    </g>
  </svg>
{:else}
  {@const alt = rest.alt ?? title ?? ""}
  {@const { alt: _, ...imgRest } = rest}
  <img
    {src}
    width={size}
    height={size}
    {alt}
    class={className}
    style={styleAttr}
    {...imgRest}
  />
{/if}
