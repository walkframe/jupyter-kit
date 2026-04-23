<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    createRenderer,
    type Executor,
    type HtmlFilter,
    type Ipynb,
    type LanguageDef,
    type Plugin,
    type RendererHandle,
    type RendererOptions,
  } from '@jupyter-kit/core';

  type Props = {
    ipynb: Ipynb;
    language?: string;
    languages?: LanguageDef[];
    plugins?: Plugin[];
    executor?: Executor;
    htmlFilter?: HtmlFilter;
    bgTransparent?: boolean;
    seqAsExecutionCount?: boolean;
    className?: string;
    filename?: string;
    mathAlign?: 'left' | 'center' | 'right';
    onload?: () => void;
  };

  let {
    ipynb,
    language,
    languages,
    plugins,
    executor,
    htmlFilter,
    bgTransparent,
    seqAsExecutionCount,
    className,
    filename,
    mathAlign,
    onload,
  }: Props = $props();

  let container: HTMLDivElement | null = $state(null);
  let handle: RendererHandle | null = null;

  const buildOptions = (): RendererOptions => ({
    language,
    languages,
    plugins,
    executor,
    htmlFilter,
    bgTransparent,
    seqAsExecutionCount,
    className,
    filename,
    mathAlign,
  });

  const remount = () => {
    if (!container) return;
    handle?.destroy();
    const renderer = createRenderer(buildOptions());
    handle = renderer.mount(container, ipynb);
  };

  onMount(() => {
    if (!container) return;
    const renderer = createRenderer(buildOptions());
    handle = renderer.mount(container, ipynb);
    onload?.();
  });

  onDestroy(() => {
    handle?.destroy();
    handle = null;
  });

  // ipynb-only changes use the cheap update path so editors aren't torn down.
  $effect(() => {
    handle?.update(ipynb);
  });

  // Option-shape changes need a full remount (plugin/executor identity may
  // differ). Touch each tracked dep so the effect re-runs.
  $effect(() => {
    void plugins;
    void executor;
    void htmlFilter;
    void language;
    void bgTransparent;
    void seqAsExecutionCount;
    void className;
    void filename;
    void mathAlign;
    if (handle) remount();
  });
</script>

<div bind:this={container} class="jupyter-kit-notebook"></div>
