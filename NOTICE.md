# Third-party notices & license elections

This file records the license choices `@jupyter-kit` makes where a
transitive dependency is offered under more than one license, and flags the
one package in the tree that is copyleft (opt-in).

The project itself is licensed Apache-2.0 — see [LICENSE](./LICENSE).

## License elections for dual-licensed dependencies

Where a dependency is published under an SPDX `OR` expression, we elect
the permissive option for the purposes of distributing
`@jupyter-kit/*` and derived works.

| Package | SPDX declaration | Elected license |
|---|---|---|
| [`jszip`](https://www.npmjs.com/package/jszip) | `(MIT OR GPL-3.0-or-later)` | **MIT** |
| [`dompurify`](https://www.npmjs.com/package/dompurify) | `(MPL-2.0 OR Apache-2.0)` | **Apache-2.0** |

`jszip` enters the graph transitively via [`webr`](https://www.npmjs.com/package/webr)
and is only pulled in when a consumer installs `@jupyter-kit/executor-webr`.
`dompurify` is a direct runtime dependency of `@jupyter-kit/core`.

## Copyleft dependency (opt-in)

[`webr`](https://www.npmjs.com/package/webr) embeds the R interpreter and
is **GPL-2.0-or-later**. It is a peer / runtime dependency of
`@jupyter-kit/executor-webr` only. Consumers who do **not** install
`executor-webr` do not pull `webr` into their graph.

Downstream projects that do ship `executor-webr` may incur GPL obligations
on their aggregate distribution. This is called out in
[`docs/reference/executor-webr`](packages/docs/src/content/docs/reference/executor-webr.mdx)
and on the project documentation site.

## Contact

Questions about licensing? Open an issue at
<https://github.com/walkframe/jupyter-kit/issues>.
