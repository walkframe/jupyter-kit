// Worker source as a template string. Injected into a Blob URL at runtime so
// consumers don't need bundler-specific worker plumbing.
//
// The worker loads pyodide from the CDN via `importScripts`, executes cells
// with a small Python helper that extracts the last expression and calls
// IPython-style `_repr_*_` formatters, and posts stdout/stderr/result back to
// the main thread. Long-running cells do NOT block the main thread.
export const WORKER_SOURCE = String.raw`
const PY_HELPERS = ${JSON.stringify(`
import ast as _ipynb_ast
import base64 as _ipynb_base64
import io as _ipynb_io
import os as _ipynb_os
import traceback as _ipynb_tb

# matplotlib's default pyodide backend tries to touch \`js.document\`, which
# does not exist inside a Web Worker. Setting MPLBACKEND before matplotlib is
# ever imported forces the pure-Python AGG backend — safe in workers and the
# right choice anyway since we render plots to PNG bytes.
_ipynb_os.environ['MPLBACKEND'] = 'AGG'
# Belt-and-braces: if matplotlib is already imported (e.g. preloaded via
# packages=[...]), flip its backend now too.
try:
    import matplotlib as _ipynb_mpl
    _ipynb_mpl.use('AGG', force=True)
except Exception:
    pass

# Suppress the \"Matplotlib is currently using agg, which is a non-GUI backend\"
# UserWarning that fires every time user code calls plt.show(). In a worker
# there's no interactive window ever, and our _ipynb_collect_figures grabs the
# figure regardless — the warning is pure noise.
import warnings as _ipynb_warnings
_ipynb_warnings.filterwarnings(
    'ignore',
    message='Matplotlib is currently using agg',
    category=UserWarning,
)

_ipynb_formats = [
    ('_repr_html_', 'text/html'),
    ('_repr_latex_', 'text/latex'),
    ('_repr_svg_', 'image/svg+xml'),
    ('_repr_png_', 'image/png'),
    ('_repr_jpeg_', 'image/jpeg'),
    ('_repr_markdown_', 'text/markdown'),
    ('_repr_json_', 'application/json'),
]

def _ipynb_mime_bundle(obj):
    data = {}

    # Preferred modern hook — returns a full mimebundle dict. ipywidgets relies
    # on this to surface \`application/vnd.jupyter.widget-view+json\`, so skipping
    # it means widgets show up as their text/plain repr instead of rendering.
    mb_fn = getattr(obj, '_repr_mimebundle_', None)
    if callable(mb_fn):
        try:
            mb = mb_fn(include=None, exclude=None)
        except TypeError:
            try:
                mb = mb_fn()
            except Exception:
                mb = None
        except Exception:
            mb = None
        if mb is not None:
            # _repr_mimebundle_ may return (bundle, metadata); keep only bundle.
            if isinstance(mb, tuple) and mb:
                mb = mb[0]
            if isinstance(mb, dict):
                for mime, val in mb.items():
                    if val is None:
                        continue
                    if mime.startswith('image/') and isinstance(val, (bytes, bytearray)):
                        val = _ipynb_base64.b64encode(val).decode('ascii')
                    data[mime] = val

    for attr, mime in _ipynb_formats:
        if mime in data:
            continue
        fn = getattr(obj, attr, None)
        if not callable(fn):
            continue
        try:
            val = fn()
        except Exception:
            continue
        if val is None:
            continue
        if isinstance(val, tuple) and val:
            val = val[0]
        if mime.startswith('image/') and isinstance(val, (bytes, bytearray)):
            val = _ipynb_base64.b64encode(val).decode('ascii')
        data[mime] = val

    # If sympy is loaded (typically after init_printing), use its LaTeX printer
    # for containers so tuples/lists/dicts render as nicely as a single
    # sympy expression does. Only opt-in: no sympy import triggered here.
    if 'text/latex' not in data and isinstance(obj, (tuple, list, dict, set, frozenset)):
        import sys as _ipynb_sys
        sympy_mod = _ipynb_sys.modules.get('sympy')
        if sympy_mod is not None:
            try:
                latex = sympy_mod.latex(obj)
                if latex:
                    data['text/latex'] = '$\\\\displaystyle ' + latex + '$'
            except Exception:
                pass

    try:
        data['text/plain'] = repr(obj)
    except Exception:
        data['text/plain'] = str(obj)
    return data

_ipynb_fig_formats = ['svg']  # overridden per-execute from JS-side options

def _ipynb_collect_figures():
    # Jupyter auto-displays open matplotlib figures at end of cell. pyodide
    # doesn't wire that up for us, so we fish them out manually.
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return []
    bundles = []
    try:
        fignums = list(plt.get_fignums())
    except Exception:
        return []
    for num in fignums:
        try:
            fig = plt.figure(num)
            bundle = {'text/plain': repr(fig)}
            for fmt in _ipynb_fig_formats:
                buf = _ipynb_io.BytesIO()
                if fmt == 'svg':
                    fig.savefig(buf, format='svg', bbox_inches='tight')
                    bundle['image/svg+xml'] = buf.getvalue().decode('utf-8')
                elif fmt == 'png':
                    fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
                    bundle['image/png'] = _ipynb_base64.b64encode(buf.getvalue()).decode('ascii')
            bundles.append(bundle)
            plt.close(fig)
        except Exception:
            continue
    return bundles

def _ipynb_close_all_figures():
    # Called from the error path so a failed cell doesn't leave figures behind
    # for the next cell to accidentally collect.
    try:
        import matplotlib.pyplot as plt
        plt.close('all')
    except Exception:
        pass

_ANSI_RED = '\\x1b[31m'
_ANSI_GREEN = '\\x1b[32m'
_ANSI_YELLOW = '\\x1b[33m'
_ANSI_CYAN = '\\x1b[36m'
_ANSI_RESET = '\\x1b[0m'
_ANSI_BOLD = '\\x1b[1m'

def _ipynb_format_exception(exc_type, exc_value, tb):
    # IPython-style: header line, per-frame location (cyan) + arrow (green) +
    # source context, final "ErrorType: msg" in red. We filter out our own
    # helper frames so the user only sees their code.
    frames = _ipynb_tb.extract_tb(tb)
    filtered = [
        fr for fr in frames
        if fr.filename not in ('<exec>', '<string>')
        and not (fr.name or '').startswith('_ipynb_')
        and 'pyodide' not in fr.filename.lower()
    ]
    if not filtered:
        filtered = frames  # nothing matched; fall back to whole tb

    out = []
    out.append(_ANSI_RED + '-' * 75 + _ANSI_RESET)
    head = _ANSI_BOLD + _ANSI_RED + exc_type.__name__ + _ANSI_RESET
    out.append(head + ' ' * 20 + 'Traceback (most recent call last)')
    for fr in filtered:
        fname = fr.filename
        display_fname = 'Cell In[?]' if fname == '<cell>' else fname
        out.append(
            _ANSI_CYAN + display_fname + _ANSI_RESET +
            ', line ' + _ANSI_CYAN + str(fr.lineno) + _ANSI_RESET +
            (', in ' + _ANSI_CYAN + fr.name + _ANSI_RESET if fr.name and fr.name != '<module>' else '')
        )
        if fr.line:
            out.append(
                _ANSI_GREEN + '----> ' + _ANSI_RESET +
                str(fr.lineno) + ' ' + fr.line
            )
    out.append('')
    msg = str(exc_value) if str(exc_value) else ''
    out.append(_ANSI_RED + exc_type.__name__ + _ANSI_RESET + ': ' + msg)
    return out

# ---- Jupyter Comm shim ---------------------------------------------------
# ipywidgets (and any other kernel-side code that opens comms) looks for either
# \`comm.create_comm\` (modern) or \`ipykernel.comm.Comm\` (legacy). We provide
# both, routing all traffic through _kit_post_comm — a JS callback the worker
# sets via py.globals.set('_kit_post_comm', ...). Without a real kernel, this
# is the only way widgets can round-trip state.

import uuid as _kit_uuid
import types as _kit_types

_KIT_COMMS = {}

def _kit_post_comm(payload):
    # Injected from JS side. If absent (widgets never enabled), comms simply
    # become no-ops — user code keeps running.
    fn = globals().get('_kit_post_comm_js')
    if fn is not None:
        try:
            fn(payload)
        except Exception:
            pass

def _kit_buffers_to_list(buffers):
    if not buffers:
        return []
    out = []
    for b in buffers:
        try:
            out.append(b.tobytes() if hasattr(b, 'tobytes') else bytes(b))
        except Exception:
            continue
    return out

class _KitComm:
    def __init__(self, target_name='', data=None, metadata=None, buffers=None,
                 comm_id=None, primary=True, target_module=None, **kwargs):
        self.comm_id = comm_id or _kit_uuid.uuid4().hex
        self.target_name = target_name
        self.target_module = target_module
        self.primary = primary
        self.kernel = object()  # truthy sentinel — ipywidgets checks \`if self.kernel\`
        self._closed = False
        self._msg_callbacks = []
        self._close_callbacks = []
        _KIT_COMMS[self.comm_id] = self
        if primary:
            self.open(data=data, metadata=metadata, buffers=buffers)

    def publish_msg(self, msg_type, data=None, metadata=None, buffers=None, **keys):
        # BaseComm-style transport hook — kept for compatibility if anyone
        # calls it directly. Normal open/send/close go through the methods
        # below (which call publish_msg).
        _kit_post_comm({
            'subtype': msg_type,
            'comm_id': self.comm_id,
            'target_name': self.target_name,
            'data': data if data is not None else {},
            'metadata': metadata if metadata is not None else {},
            'buffers': _kit_buffers_to_list(buffers),
        })

    def open(self, data=None, metadata=None, buffers=None):
        self.publish_msg('comm_open', data=data, metadata=metadata, buffers=buffers)

    def send(self, data=None, metadata=None, buffers=None):
        if self._closed:
            return
        self.publish_msg('comm_msg', data=data, metadata=metadata, buffers=buffers)

    def close(self, data=None, metadata=None, buffers=None, deleting=False):
        if self._closed:
            return
        self._closed = True
        self.publish_msg('comm_close', data=data, metadata=metadata, buffers=buffers)
        _KIT_COMMS.pop(self.comm_id, None)

    def on_msg(self, callback):
        self._msg_callbacks.append(callback)

    def on_close(self, callback):
        self._close_callbacks.append(callback)

    def handle_msg(self, msg):
        for cb in list(self._msg_callbacks):
            try:
                cb(msg)
            except Exception:
                import traceback as _tb
                _tb.print_exc()

    def handle_close(self, msg):
        self._closed = True
        _KIT_COMMS.pop(self.comm_id, None)
        for cb in list(self._close_callbacks):
            try:
                cb(msg)
            except Exception:
                import traceback as _tb
                _tb.print_exc()

class _KitCommManager:
    def __init__(self):
        self.targets = {}
    def register_target(self, target_name, callback):
        self.targets[target_name] = callback
    def unregister_target(self, target_name, callback=None):
        self.targets.pop(target_name, None)

_KIT_COMM_MANAGER = _KitCommManager()

def _kit_create_comm(target_name='', data=None, metadata=None, buffers=None,
                     comm_id=None, primary=True, **kwargs):
    return _KitComm(
        target_name=target_name, data=data, metadata=metadata, buffers=buffers,
        comm_id=comm_id, primary=primary, **kwargs,
    )

def _kit_get_comm_manager():
    return _KIT_COMM_MANAGER

def _kit_install_comm_shim():
    import sys
    # 1) ipykernel stub — ipywidgets >=8 checks \`ipykernel.version_info\` to
    # decide whether to install its own shim (any ipykernel <6 triggers that).
    # We present as >=6 so ipywidgets skips its shim and goes straight to
    # comm.create_comm, which we've overridden below.
    if 'ipykernel' not in sys.modules:
        m = _kit_types.ModuleType('ipykernel')
        sys.modules['ipykernel'] = m
    if not hasattr(sys.modules['ipykernel'], 'version_info'):
        sys.modules['ipykernel'].version_info = (6, 0, 0)
    if not hasattr(sys.modules['ipykernel'], '__version__'):
        sys.modules['ipykernel'].__version__ = '6.0.0'
    # 2) ipykernel.comm.Comm — older ipywidgets <8 path.
    if 'ipykernel.comm' not in sys.modules:
        m = _kit_types.ModuleType('ipykernel.comm')
        m.Comm = _KitComm
        sys.modules['ipykernel.comm'] = m
        try:
            sys.modules['ipykernel'].comm = m
        except Exception:
            pass
    else:
        try:
            sys.modules['ipykernel.comm'].Comm = _KitComm
        except Exception:
            pass

    # 2) comm package — ipywidgets >=8 path. Override the factory / manager so
    # existing BaseComm/kernel infrastructure isn't relied on.
    if 'comm' in sys.modules:
        mod = sys.modules['comm']
    else:
        mod = _kit_types.ModuleType('comm')
        sys.modules['comm'] = mod
    mod.create_comm = _kit_create_comm
    mod.get_comm_manager = _kit_get_comm_manager

_kit_install_comm_shim()

def _kit_dispatch_comm(payload):
    # payload arrives from JS as a JsProxy. Convert to a real Python dict so
    # downstream ipywidgets code (which does nested \`data['state']\` lookups
    # expecting Python dicts) doesn't trip on JsProxy semantics.
    try:
        payload = payload.to_py() if hasattr(payload, 'to_py') else payload
    except Exception:
        pass
    if not isinstance(payload, dict):
        return
    subtype = payload.get('subtype')
    comm_id = payload.get('comm_id')
    if subtype == 'open_frontend':
        target_name = payload.get('target_name', '')
        data = payload.get('data') or {}
        # Frontend opened a comm — create on kernel side and fire the
        # registered target callback, if any.
        comm = _KitComm(target_name=target_name, comm_id=comm_id, primary=False)
        cb = _KIT_COMM_MANAGER.targets.get(target_name)
        if cb is not None:
            msg = {'content': {'target_name': target_name, 'comm_id': comm_id, 'data': data}}
            try:
                cb(comm, msg)
            except Exception:
                import traceback as _tb
                _tb.print_exc()
        return
    comm = _KIT_COMMS.get(comm_id)
    if comm is None:
        _s.stderr.write('[kit] no comm registered for id=' + repr(comm_id) + '\\n')
        return
    if subtype == 'comm_msg':
        msg = {
            'content': {'comm_id': comm_id, 'data': payload.get('data') or {}},
            'buffers': list(payload.get('buffers') or []),
            'metadata': payload.get('metadata') or {},
        }
        comm.handle_msg(msg)
    elif subtype == 'comm_close':
        msg = {'content': {'comm_id': comm_id, 'data': payload.get('data') or {}}}
        comm.handle_close(msg)

# --- ipywidgets.interactive matplotlib capture shim ----------------------
# Jupyter's Output widget captures matplotlib figures via IPython's display
# hooks. We don't have an IPython shell, so after a slider change the user's
# function creates a figure but nothing ends up inside the Output widget.
# Patch \`interactive.update\` to render any matplotlib figure the call
# produces, then push it into the widget's Output via \`self.out.outputs\`.
# \`self.out.outputs = (...)\` triggers a comm_msg that the frontend applies
# to the Output widget DOM.
_KIT_INTERACTIVE_PATCHED = False

def _kit_patch_interactive_once():
    global _KIT_INTERACTIVE_PATCHED
    if _KIT_INTERACTIVE_PATCHED:
        return
    import sys as _sys
    if 'ipywidgets' not in _sys.modules:
        return
    try:
        import ipywidgets as _iw
        _original_update = _iw.interactive.update
    except Exception:
        return
    import io as _io
    import base64 as _b64

    def _patched_update(self, *args, **kwargs):
        try:
            import matplotlib.pyplot as plt
        except Exception:
            plt = None
        try:
            _original_update(self, *args, **kwargs)
        finally:
            if plt is None:
                return
            try:
                fignums = list(plt.get_fignums())
            except Exception:
                return
            new_outputs = []
            for num in fignums:
                try:
                    fig = plt.figure(num)
                    buf = _io.BytesIO()
                    fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
                    png = _b64.b64encode(buf.getvalue()).decode('ascii')
                    new_outputs.append({
                        'output_type': 'display_data',
                        'data': {
                            'image/png': png,
                            'text/plain': '<Figure>',
                        },
                        'metadata': {},
                    })
                    plt.close(fig)
                except Exception:
                    continue
            if new_outputs and hasattr(self, 'out'):
                try:
                    self.out.outputs = tuple(new_outputs)
                except Exception:
                    pass

    _iw.interactive.update = _patched_update
    _KIT_INTERACTIVE_PATCHED = True

def _ipynb_run_cell(source):
    # Return shape is always {'outputs': [...], 'error': None | {...}} so the
    # caller never has to cross the JS/Python boundary for exceptions — we
    # catch BaseException here and format it while we still have access to the
    # real Python traceback. (Any JS-side catch receives a wrapped JsException
    # that has already lost frame info.)
    import sys as _ipynb_sys
    g = globals()
    try:
        tree = _ipynb_ast.parse(source, '<cell>', 'exec')
    except SyntaxError:
        exc_type, exc_value, tb = _ipynb_sys.exc_info()
        return {
            'outputs': [],
            'error': {
                'name': exc_type.__name__,
                'message': str(exc_value),
                'traceback': _ipynb_format_exception(exc_type, exc_value, tb),
            },
        }

    # Patch ipywidgets.interactive once the library is importable so slider
    # changes re-render matplotlib figures inside the widget's Output area.
    _kit_patch_interactive_once()

    outputs = []
    result_value = None
    try:
        if tree.body:
            last = tree.body[-1]
            if isinstance(last, _ipynb_ast.Expr):
                if len(tree.body) > 1:
                    head = _ipynb_ast.Module(body=tree.body[:-1], type_ignores=[])
                    exec(compile(head, '<cell>', 'exec'), g)
                result_value = eval(compile(_ipynb_ast.Expression(last.value), '<cell>', 'eval'), g)
            else:
                exec(compile(tree, '<cell>', 'exec'), g)
    except BaseException:
        exc_type, exc_value, tb = _ipynb_sys.exc_info()
        _ipynb_close_all_figures()
        return {
            'outputs': [],
            'error': {
                'name': exc_type.__name__ if exc_type else 'Error',
                'message': str(exc_value) if exc_value else '',
                'traceback': _ipynb_format_exception(exc_type, exc_value, tb),
            },
        }

    # Widgets first, figures second. In Jupyter, interactive()'s Output widget
    # would capture the figure as its own child — we don't emulate that
    # (no IPython display hook), so the figure is posted as a separate
    # display_data. Ordering the widget before the figure keeps the sliders
    # above the plot, matching Jupyter's visual layout.
    if result_value is not None:
        outputs.append({'type': 'execute_result', 'data': _ipynb_mime_bundle(result_value)})

    for fig_bundle in _ipynb_collect_figures():
        outputs.append({'type': 'display_data', 'data': fig_bundle})

    return {'outputs': outputs, 'error': None}
`)};

function stripMagics(source) {
  return source.split('\n').map(function (line) {
    var t = line.replace(/^\s*/, '');
    if (t.startsWith('%') || t.startsWith('!')) return '# ' + line;
    return line;
  }).join('\n');
}

let pyodide = null;
let bootPromise = null;

function ensureBoot(bootOpts) {
  if (pyodide) return Promise.resolve(pyodide);
  if (!bootPromise) {
    bootPromise = (async () => {
      // Walk the fallback list until one CDN serves pyodide.js. Each
      // failure throws from importScripts (sync) or loadPyodide (async)
      // — capture and move on to the next candidate so a single CDN
      // outage doesn't wedge the whole page.
      const candidates = bootOpts.candidates || [];
      if (!candidates.length) throw new Error('no pyodide boot candidates provided');
      const timeoutMs = bootOpts.timeoutMs || 0;
      let py = null;
      const errors = [];
      for (const c of candidates) {
        try {
          // importScripts is synchronous — only the async loadPyodide call
          // actually benefits from a race-based timeout. importScripts
          // failures (404 / DNS / CSP) throw synchronously and get
          // caught below.
          self.importScripts(c.src);
          const loadWithTimeout = timeoutMs > 0
            ? Promise.race([
                self.loadPyodide({ indexURL: c.indexURL }),
                new Promise((_, rej) =>
                  setTimeout(
                    () => rej(new Error('loadPyodide timeout (' + timeoutMs + 'ms)')),
                    timeoutMs,
                  ),
                ),
              ])
            : self.loadPyodide({ indexURL: c.indexURL });
          py = await loadWithTimeout;
          break;
        } catch (err) {
          errors.push((c.src || 'unknown') + ': ' + ((err && err.message) || err));
          py = null;
        }
      }
      if (!py) throw new Error('all pyodide CDN candidates failed:\n' + errors.join('\n'));
      if (bootOpts.packages && bootOpts.packages.length) {
        // Try the bundled pyodide repodata first, then fall back to PyPI via
        // micropip for anything loadPackage doesn't recognise. Falling back
        // per-name keeps the well-known package path (numpy etc.) on the
        // fast path and only pays the micropip import when needed.
        let micropipLoaded = false;
        for (const name of bootOpts.packages) {
          try {
            await py.loadPackage(name);
          } catch (err) {
            if (!micropipLoaded) {
              try {
                await py.loadPackage('micropip');
                micropipLoaded = true;
              } catch (_) { /* micropip itself should always exist — ignore */ }
            }
            try {
              const micropip = py.pyimport('micropip');
              await micropip.install(name);
            } catch (err2) {
              self.postMessage({ type: 'stderr', id: 0, text: '[pyodide] failed to install ' + name + ': ' + (err2 && err2.message || err2) + '\n' });
            }
          }
        }
      }
      await py.runPythonAsync(PY_HELPERS);
      // Wire the Python comm shim to postMessage. Called from kernel-side
      // Comm.open/send/close — routed to the main thread as {type:'comm'}.
      py.globals.set('_kit_post_comm_js', function (payload) {
        try {
          const obj = (payload && typeof payload.toJs === 'function')
            ? payload.toJs({ dict_converter: function (entries) {
                const o = {}; for (const [k, v] of entries) o[k] = v; return o;
              } })
            : payload;
          self.postMessage({ type: 'comm', payload: obj });
        } catch (e) {
          // Comm transport errors mustn't crash the cell.
        }
      });
      pyodide = py;
      return py;
    })();
  }
  return bootPromise;
}

function dispatchComm(payload) {
  if (!pyodide) return;
  try {
    pyodide.globals.set('_kit_comm_payload', payload);
    pyodide.runPython('_kit_dispatch_comm(_kit_comm_payload)');
  } catch (e) {
    // Swallow — comm dispatch errors must not terminate the worker.
  }
}

self.onmessage = async function (e) {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === 'comm') {
    dispatchComm(msg.payload);
    return;
  }
  if (msg.type !== 'execute') return;
  const id = msg.id;
  const post = function (data) { self.postMessage(Object.assign({ id: id }, data)); };

  try {
    const py = await ensureBoot(msg.boot);
    const src = stripMagics(msg.source);

    if (msg.autoloadImports) {
      post({ type: 'installing' });
      try { await py.loadPackagesFromImports(src); } catch (err) { /* ignore */ }
    }

    // Per-execute config flags pushed into the Python namespace.
    if (Array.isArray(msg.figureFormats) && msg.figureFormats.length) {
      py.globals.set('_ipynb_fig_formats', msg.figureFormats);
    }

    py.setStdout({ batched: function (s) { post({ type: 'stdout', text: s }); } });
    py.setStderr({ batched: function (s) { post({ type: 'stderr', text: s }); } });

    post({ type: 'running' });
    py.globals.set('_ipynb_cell_src', src);

    // _ipynb_run_cell returns {outputs, error} — exceptions are caught in
    // Python where the real traceback is still available. No try/catch around
    // runPythonAsync here.
    const resultProxy = await py.runPythonAsync('_ipynb_run_cell(_ipynb_cell_src)');
    let resultObj = null;
    if (resultProxy != null && typeof resultProxy.toJs === 'function') {
      try {
        resultObj = resultProxy.toJs({
          dict_converter: function (entries) {
            const obj = {};
            for (const [k, v] of entries) obj[k] = v;
            return obj;
          },
        });
      } catch (_) { resultObj = null; }
      try { resultProxy.destroy && resultProxy.destroy(); } catch (_) {}
    }

    if (resultObj && resultObj.error) {
      post({
        type: 'error',
        name: resultObj.error.name || 'PythonError',
        message: resultObj.error.message || '',
        traceback: resultObj.error.traceback || null,
      });
    } else if (resultObj && resultObj.outputs) {
      for (let i = 0; i < resultObj.outputs.length; i++) {
        const o = resultObj.outputs[i];
        if (!o) continue;
        if (o.type === 'display_data') {
          post({ type: 'display_data', bundle: o.data || null });
        } else if (o.type === 'execute_result') {
          post({ type: 'result', bundle: o.data || null });
        }
      }
    }
  } catch (err) {
    // Fallback for boot failures / infra errors only — user code exceptions
    // are already handled structurally via _ipynb_run_cell above.
    post({
      type: 'error',
      name: (err && (err.name || err.type)) || 'InfraError',
      message: (err && err.message) || String(err),
      traceback: null,
    });
  } finally {
    try { pyodide && pyodide.setStdout({}); } catch (_) {}
    try { pyodide && pyodide.setStderr({}); } catch (_) {}
    post({ type: 'done' });
  }
};
`;
