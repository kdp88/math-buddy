// Stub out Expo's import.meta registry which uses ESM syntax
// that Jest's CommonJS transform cannot handle.
class ImportMetaRegistry {}
module.exports = { ImportMetaRegistry };
