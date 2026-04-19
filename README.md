# React Ipynb Renderer
This is a library to easily draw ipynb in a React application.

[![npm version](https://img.shields.io/npm/v/react-ipynb-renderer)](https://www.npmjs.com/package/react-ipynb-renderer)
[![e2e workflow](https://github.com/righ/react-ipynb-renderer/actions/workflows/e2e.yaml/badge.svg?branch=master)](https://github.com/righ/react-ipynb-renderer/actions/workflows/e2e.yaml)
[![License](https://img.shields.io/npm/l/react-ipynb-renderer)](https://github.com/righ/react-ipynb-renderer/blob/main/LICENSE)
![downloads](https://img.shields.io/npm/dm/react-ipynb-renderer?style=flat-square)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Frigh%2Freact-ipynb-renderer.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Frigh%2Freact-ipynb-renderer?ref=badge_shield)

<p align="center">
  <img src="brand/icon.svg" alt="jupyter-kit" width="180" height="180" />
</p>

## Theme

Please choose your favorite combination from the multiple themes available for Jupyter and syntax highlighting. 

There are several options for each, allowing you to find the perfect match for your preference.

| solarizedl and duotone forest themes                                                                                          | monokai and xonokai themes                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ![solarizedl](https://github.com/righ/react-ipynb-renderer/raw/master/images/solarizedl-duotone_earth.png) | ![monokai](https://github.com/righ/react-ipynb-renderer/raw/master/images/monokai-xonokai.png) |

As for jupyter themes, you may use your own customized CSS. You do not necessarily have to use the prepared jupyter theme.


## Formula renderer
You can choose Mathjax or Katex for rendering formulas. 

Normally I would recommend choosing react-ipynb-renderer which uses Mathjax.
react-ipynb-renderer-katex is a bit lighter than the mathjax version.

| Mathjax | Katex |
| ------- | ----- |
| [![NPM](https://nodei.co/npm/react-ipynb-renderer.png?mini=true)](https://www.npmjs.com/package/react-ipynb-renderer) | [![NPM](https://nodei.co/npm/react-ipynb-renderer-katex.png?mini=true)](https://www.npmjs.com/package/react-ipynb-renderer-katex) |
| [![CodeSandbox](https://img.shields.io/badge/Codesandbox-FFFFFF?style=for-the-badge&logo=codesandbox&logoColor=159D48)](https://codesandbox.io/s/react-ipynb-renderer-sample-kbu4z?file=/src/App.tsx) | [![CodeSandbox](https://img.shields.io/badge/Codesandbox-2B9895?style=for-the-badge&logo=codesandbox&logoColor=FFFFFF)](https://codesandbox.io/s/react-ipynb-renderer-katex-sample-770np1?file=/src/App.tsx) |

These will be released at the same time, so the versions will be the same. Even if only one of them has been changed.


# Install

```sh
$ npm install --save react-ipynb-renderer
```

or

```sh
$ npm install --save react-ipynb-renderer-katex
```

# Usage
Just pass an ipynb json object to `IpynbRenderer` component.

## Using ipynb as a string
If you have an ipynb file as a string, you can parse it using `JSON.parse()`:

```jsx
import { IpynbRenderer } from "react-ipynb-renderer";

// Jupyter theme
import "react-ipynb-renderer/dist/styles/monokai.css";

export const Component = () => {
  const ipynbString = `{
    "cells": [
      {
        "cell_type": "markdown",
        "metadata": {},
        "source": ["# Hello World"]
      }
    ],
    "metadata": {},
    "nbformat": 4,
    "nbformat_minor": 4
  }`;
  
  const ipynb = JSON.parse(ipynbString);
  
  return (
    <IpynbRenderer ipynb={ipynb} />
  );
};
```

## Simplest example

### Using react-ipynb-renderer

```jsx
import { IpynbRenderer } from "react-ipynb-renderer";

// Jupyter theme
import "react-ipynb-renderer/dist/styles/monokai.css";
// import ipynb file as json
import ipynb from "./test.ipynb";

export const Component = () => {
  return (
    <IpynbRenderer ipynb={ipynb} />
  );
};
```

### Using react-ipynb-renderer-katex

```jsx
import { IpynbRenderer } from "react-ipynb-renderer-katex";

// Formula renderer for katex
import 'katex/dist/katex.min.css';

// Jupyter theme
import "react-ipynb-renderer-katex/dist/styles/monokai.css";
// import ipynb file as json
import ipynb from "./test.ipynb";

export const Component = () => {
  return (
    <IpynbRenderer ipynb={ipynb} />
  );
};
```

# Links

- https://docs.walkframe.com/react-ipynb-renderer
- https://www.npmjs.com/package/react-ipynb-renderer


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Frigh%2Freact-ipynb-renderer.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Frigh%2Freact-ipynb-renderer?ref=badge_large)