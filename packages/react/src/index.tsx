import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  createRenderer,
  type Ipynb,
  type RendererHandle,
  type RendererOptions,
} from '@jupyter-kit/core';

export type NotebookProps = Omit<RendererOptions, 'plugins'> &
  Pick<RendererOptions, 'plugins'> & {
    ipynb: Ipynb;
    onLoad?: () => void;
  };

export type NotebookRef = {
  /** Access the underlying core renderer handle. */
  handle(): RendererHandle | null;
  /** The mount target element (the container the renderer attaches to). */
  el(): HTMLDivElement | null;
};

function Component(
  props: NotebookProps,
  ref: React.Ref<NotebookRef>,
) {
  const { ipynb, onLoad, ...rendererOpts } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RendererHandle | null>(null);

  // Mount on first render or when option identity changes. Plugins/executor
  // changes destroy and rebuild — keep them stable on the caller side.
  useEffect(() => {
    if (!containerRef.current) return;
    const renderer = createRenderer(rendererOpts);
    handleRef.current = renderer.mount(containerRef.current, ipynb);
    onLoad?.();
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rendererOpts.plugins,
    rendererOpts.executor,
    rendererOpts.htmlFilter,
    rendererOpts.language,
    rendererOpts.bgTransparent,
    rendererOpts.seqAsExecutionCount,
    rendererOpts.className,
    rendererOpts.filename,
    rendererOpts.mathAlign,
  ]);

  // Re-render cells when ipynb changes, without rebuilding the renderer.
  useEffect(() => {
    handleRef.current?.update(ipynb);
  }, [ipynb]);

  useImperativeHandle(
    ref,
    () => ({
      handle: () => handleRef.current,
      el: () => containerRef.current,
    }),
    [],
  );

  return <div ref={containerRef} className="jupyter-kit-notebook" />;
}

export const Notebook = React.memo(
  forwardRef<NotebookRef, NotebookProps>(Component),
);

// Re-export core types. The ipynb document type is `Ipynb` in core so it
// never shadows this package's `Notebook` component export.
export type {
  CellHandle,
  CellType,
  Executor,
  HtmlFilter,
  Ipynb,
  OutputType,
  Plugin,
  RendererHandle,
  RendererOptions,
} from '@jupyter-kit/core';
