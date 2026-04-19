// `webr` doesn't expose its declaration files for the bare-specifier import
// path we use (only deep paths work). Stub it as `any` here — the runtime
// import call site casts to a precise local interface.
declare module 'webr';
