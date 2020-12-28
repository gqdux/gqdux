module.exports = {
  "moduleDirectories": [
    "./node_modules",
    "./packages"
  ],
  "verbose":false,
  "transformIgnorePatterns": [
    "<rootDir>/node_modules/(?!lodash-es)/.*"
  ],
  "moduleNameMapper": {
    "@a-laughlin/(.*)$": "<rootDir>/packages/$1/src/$1"
  },
  "moduleFileExtensions": [
    "js",
    "mjs"
  ],
  "transform": {
    "^.+\\.js$": "babel-jest"
  }
}