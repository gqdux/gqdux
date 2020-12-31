module.exports = {
  "moduleDirectories": [
    "./node_modules",
    "./packages"
  ],
  "verbose":false,
  "transformIgnorePatterns": [
    "<rootDir>\/node_modules\/(?!(redux|graphql-tag-bundled|react|react-dom|react-test-renderer|@testing-library|@a-laughlin\/fp-utils))\/.*",
  ],
  // "moduleNameMapper": {
  //   "@a-laughlin/(.*)$": "<rootDir>/packages/$1/src/$1"
  // },
  "moduleFileExtensions": [
    "js",
    "mjs"
  ],
  // "transform": {
  //   "^.+\\test.js$": "babel-jest"
  // }
  // "transform": { }
}