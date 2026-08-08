"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/unist-util-remove-position";
exports.ids = ["vendor-chunks/unist-util-remove-position"];
exports.modules = {

/***/ "(ssr)/../node_modules/unist-util-remove-position/lib/index.js":
/*!***************************************************************!*\
  !*** ../node_modules/unist-util-remove-position/lib/index.js ***!
  \***************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   removePosition: () => (/* binding */ removePosition)\n/* harmony export */ });\n/* harmony import */ var unist_util_visit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! unist-util-visit */ \"(ssr)/../node_modules/unist-util-visit/lib/index.js\");\n/**\n * @typedef {import('unist').Node} Node\n */\n\n/**\n * @typedef Options\n *   Configuration.\n * @property {boolean | null | undefined} [force=false]\n *   Whether to use `delete` to remove `position` fields.\n *\n *   The default is to set them to `undefined`.\n */\n\n\n\n/**\n * Remove the `position` field from a tree.\n *\n * @param {Node} tree\n *   Tree to clean.\n * @param {Options | null | undefined} [options={force: false}]\n *   Configuration (default: `{force: false}`).\n * @returns {undefined}\n *   Nothing.\n */\nfunction removePosition(tree, options) {\n  const config = options || {}\n  const force = config.force || false\n\n  ;(0,unist_util_visit__WEBPACK_IMPORTED_MODULE_0__.visit)(tree, remove)\n\n  /**\n   * @param {Node} node\n   */\n  function remove(node) {\n    if (force) {\n      delete node.position\n    } else {\n      node.position = undefined\n    }\n  }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi4vbm9kZV9tb2R1bGVzL3VuaXN0LXV0aWwtcmVtb3ZlLXBvc2l0aW9uL2xpYi9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0EsYUFBYSxzQkFBc0I7QUFDbkM7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsY0FBYyw0QkFBNEI7QUFDMUM7QUFDQTtBQUNBO0FBQ0E7O0FBRXNDOztBQUV0QztBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakI7QUFDQSxXQUFXLDRCQUE0QixVQUFVLGFBQWE7QUFDOUQsK0JBQStCLGFBQWE7QUFDNUMsYUFBYTtBQUNiO0FBQ0E7QUFDTztBQUNQO0FBQ0E7O0FBRUEsRUFBRSx3REFBSzs7QUFFUDtBQUNBLGFBQWEsTUFBTTtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU07QUFDTjtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxhY2NwZW9wXFxPbmVEcml2ZVxcRGVza3RvcFxcZ2VuZXJhdGVjb3Vyc2VcXG5vZGVfbW9kdWxlc1xcdW5pc3QtdXRpbC1yZW1vdmUtcG9zaXRpb25cXGxpYlxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAdHlwZWRlZiB7aW1wb3J0KCd1bmlzdCcpLk5vZGV9IE5vZGVcbiAqL1xuXG4vKipcbiAqIEB0eXBlZGVmIE9wdGlvbnNcbiAqICAgQ29uZmlndXJhdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbiB8IG51bGwgfCB1bmRlZmluZWR9IFtmb3JjZT1mYWxzZV1cbiAqICAgV2hldGhlciB0byB1c2UgYGRlbGV0ZWAgdG8gcmVtb3ZlIGBwb3NpdGlvbmAgZmllbGRzLlxuICpcbiAqICAgVGhlIGRlZmF1bHQgaXMgdG8gc2V0IHRoZW0gdG8gYHVuZGVmaW5lZGAuXG4gKi9cblxuaW1wb3J0IHt2aXNpdH0gZnJvbSAndW5pc3QtdXRpbC12aXNpdCdcblxuLyoqXG4gKiBSZW1vdmUgdGhlIGBwb3NpdGlvbmAgZmllbGQgZnJvbSBhIHRyZWUuXG4gKlxuICogQHBhcmFtIHtOb2RlfSB0cmVlXG4gKiAgIFRyZWUgdG8gY2xlYW4uXG4gKiBAcGFyYW0ge09wdGlvbnMgfCBudWxsIHwgdW5kZWZpbmVkfSBbb3B0aW9ucz17Zm9yY2U6IGZhbHNlfV1cbiAqICAgQ29uZmlndXJhdGlvbiAoZGVmYXVsdDogYHtmb3JjZTogZmFsc2V9YCkuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICogICBOb3RoaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlUG9zaXRpb24odHJlZSwgb3B0aW9ucykge1xuICBjb25zdCBjb25maWcgPSBvcHRpb25zIHx8IHt9XG4gIGNvbnN0IGZvcmNlID0gY29uZmlnLmZvcmNlIHx8IGZhbHNlXG5cbiAgdmlzaXQodHJlZSwgcmVtb3ZlKVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAgICovXG4gIGZ1bmN0aW9uIHJlbW92ZShub2RlKSB7XG4gICAgaWYgKGZvcmNlKSB7XG4gICAgICBkZWxldGUgbm9kZS5wb3NpdGlvblxuICAgIH0gZWxzZSB7XG4gICAgICBub2RlLnBvc2l0aW9uID0gdW5kZWZpbmVkXG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/../node_modules/unist-util-remove-position/lib/index.js\n");

/***/ })

};
;