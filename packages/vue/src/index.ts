import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from 'vue';
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

/**
 * Vue 3 wrapper around `@jupyter-kit/core`. The renderer is mounted to an
 * internal `<div>` once, and re-used across `ipynb` prop changes via
 * `handle.update(...)` so the DOM (and any active CodeMirror editors) is not
 * torn down needlessly.
 */
export const Notebook = /* #__PURE__ */ defineComponent({
  name: 'Notebook',
  props: {
    ipynb: {
      type: Object as PropType<Ipynb>,
      required: true,
    },
    language: { type: String, default: undefined },
    languages: { type: Array as PropType<LanguageDef[]>, default: undefined },
    plugins: { type: Array as PropType<Plugin[]>, default: undefined },
    executor: { type: Object as PropType<Executor>, default: undefined },
    htmlFilter: { type: Function as PropType<HtmlFilter>, default: undefined },
    bgTransparent: { type: Boolean, default: undefined },
    seqAsExecutionCount: { type: Boolean, default: undefined },
    className: { type: String, default: undefined },
    filename: { type: String, default: undefined },
    mathAlign: {
      type: String as PropType<'left' | 'center' | 'right'>,
      default: undefined,
    },
  },
  emits: ['load'],
  setup(props, { expose, emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    // shallowRef so Vue's reactivity doesn't deep-walk the handle (which
    // contains DOM nodes and function closures).
    const handle = shallowRef<RendererHandle | null>(null);

    const buildOptions = (): RendererOptions => ({
      language: props.language,
      languages: props.languages,
      plugins: props.plugins,
      executor: props.executor,
      htmlFilter: props.htmlFilter,
      bgTransparent: props.bgTransparent,
      seqAsExecutionCount: props.seqAsExecutionCount,
      className: props.className,
      filename: props.filename,
      mathAlign: props.mathAlign,
    });

    onMounted(() => {
      if (!containerRef.value) return;
      const renderer = createRenderer(buildOptions());
      handle.value = renderer.mount(containerRef.value, props.ipynb);
      emit('load');
    });

    onBeforeUnmount(() => {
      handle.value?.destroy();
      handle.value = null;
    });

    // Prop-driven rebuilds. `ipynb` uses the cheap `.update()` path; option
    // changes require a full remount (plugin/executor identity may differ).
    watch(
      () => props.ipynb,
      (nb) => {
        handle.value?.update(nb);
      },
    );
    watch(
      () => [
        props.plugins,
        props.executor,
        props.htmlFilter,
        props.language,
        props.bgTransparent,
        props.seqAsExecutionCount,
        props.className,
        props.filename,
        props.mathAlign,
      ],
      () => {
        if (!containerRef.value) return;
        handle.value?.destroy();
        const renderer = createRenderer(buildOptions());
        handle.value = renderer.mount(containerRef.value, props.ipynb);
      },
    );

    expose({
      handle: () => handle.value,
      el: () => containerRef.value,
    });

    // Pass the ref object directly instead of a closure — the closure form
    // gets a new identity on every render, causing Vue to detach/reattach
    // the ref each pass and briefly reset `containerRef.value` to null.
    return () =>
      h('div', {
        ref: containerRef,
        class: 'jupyter-kit-notebook',
      });
  },
});

// Re-export core types. The ipynb document type is `Ipynb` in core so it
// never shadows this package's `Notebook` component export.
export type {
  CellHandle,
  CellType,
  Executor,
  HtmlFilter,
  Ipynb,
  LanguageDef,
  OutputType,
  Plugin,
  RendererHandle,
  RendererOptions,
} from '@jupyter-kit/core';
