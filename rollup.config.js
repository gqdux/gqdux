// rollup.config.js
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs"; // only for xstream and react
import visualizer from "rollup-plugin-visualizer";
import { terser } from "rollup-plugin-terser";
import copy from "rollup-plugin-cpy";
import alias from "@rollup/plugin-alias";
import analyze from "rollup-plugin-analyzer";
import sourcemap from "rollup-plugin-sourcemaps";

import { readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import injectProcessEnv from "rollup-plugin-inject-process-env";

const snakeToStartCase = (s) =>
  s
    .split("-")
    .map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join("");
// import {default as transpile} from '@rollup/plugin-sucrase';
// const prettier = require('rollup-plugin-prettier');
// const eslint = require('rollup-plugin-prettier');

// TODO
// - imports work with directly importing packages/<name>/dist/es/<name>.js, but not by importing
//   packages/<name>/dist as specified by module field in package.json.  Why?
// - tree shaking doesn't work with makeCollectionFn in fp-utils, resulting in many unnecessry exports
// - how to use processEnvPlugin in the loop for dev and production(min, with srcmaps)

// sets the process object in each environment
const processEnvPlugin = injectProcessEnv({
  NODE_ENV: process.env.NODE_ENV || "production",
});

const resolvePlugin = resolve({
  customResolveOptions: {
    moduleDirectory: "node_modules",
  },
  mainFields: ["module", "main", "browser"],
});
const commonjsPlugin = commonjs({ esmExternals: true });
const sourceMapPlugin = sourcemap();
const terserPlugin = terser();

// const getExamplePlugin = ()=>({
//   name: 'json-packages', // this name will show up in warnings and errors
//   // returning source avoids rollup looking for the id in other plugins or the file system
//   resolveId:source =>source === '\0custom-packages' ? source : null,
//   // loads the source code for virtual module, else passes on to next plugin
//   load:id=>id === '\0custom-packages' ? 'export default "This is virtual!"' : null,
//   transform:({format})=>{}
// });
// { // example plugin
//   input: '\0virtual-module',
//   plugins: [getExamplePlugin()],
//   output: [{
//     file: 'dist/virtual-module.js',
//     format: 'es'
//   }]
// }

const modules = readdirSync("packages")
  .filter((dir) => dir !== ".DS_Store")
  .map((dir) => ({
    dir,
    outDir: join(`packages`, dir, "dist"),
    inDir: join(`packages`, dir, "src"),
    entryFileNames: join(`packages`, dir, "src", `${dir}.js`),
  }))
  .map(({ dir, outDir, inDir, entryFileNames, pkg }) => ({
    external: [
      // "lodash-es",
      // "react",
      // "react-dom",
      // "xstream",
      // 'graphql', // prevents adding it to bundles
      // 'graphql-tag'
    ],
    input: join(inDir, `${dir}.js`),
    output: [
      { format: "es", type: "module" },
      { format: "umd", type: "umd" },
      { format: "cjs", type: "commonjs" },
    ].flatMap(({ format, type }) => {
      const dev = {
        format,
        entryFileNames,
        compact: true,
        file: join(outDir, format, `${dir}.js`),
        // based on https://lihautan.com/12-line-rollup-plugin/
        plugins: [
          {
            name: "write-package.json",
            generateBundle() {
              mkdirSync(join(outDir, format), { recursive: true });
              format !== "es" &&
                writeFileSync(
                  join(outDir, format, "package.json"),
                  JSON.stringify({ type }, null, 2)
                );
            },
          },
        ],
      };

      const prod = {
        ...dev,
        file: join(outDir, format, `${dir}.min.js`),
        sourcemap: true,
        plugins: [terserPlugin],
      };

      const globalArgs = {
        name: snakeToStartCase(dir),
        globals: {
          // for umd build, defines the global names
          react: "react",
          "graphql-tag-bundled": "gql",
        },
      };
      if (dir === "graphql-tag-bundled")
        Object.assign(globalArgs, { name: "gql", exports: "default" });
      Object.assign(dev, globalArgs);
      Object.assign(prod, globalArgs);
      return [dev, prod];
    }),
    plugins: [
      alias({
        entries: [
          // rollup is unaware of yarn workspaces, so alias input paths when building
          {
            find: "@a-laughlin/fp-utils",
            replacement: "@a-laughlin/fp-utils/es/fp-utils.js",
          },
          // { find: 'react', replacement: 'https://unpkg.com/react@16/umd/react.development.js' },
        ],
      }),
      resolvePlugin,
      commonjsPlugin, // must go after resolve
      processEnvPlugin, // must go after commonjs
      sourceMapPlugin,
      copy([{ files: join(`packages`, dir, "{LICENSE}"), dest: outDir }]),
      analyze({
        showExports: true,
        writeTo: (s) =>
          writeFileSync(join(`packages`, dir, "generated_stats.txt"), s),
        onAnalysis: (o) =>
          writeFileSync(
            join(`packages`, dir, "generated_stats.json"),
            JSON.stringify(o, null, 2)
          ),
      }),
      visualizer({
        template: "treemap",
        filename: join(`packages`, dir, "stats-treemap.html"),
      }),
      visualizer({
        template: "network",
        filename: join(`packages`, dir, "stats-network.html"),
      }),
      {
        name: "write-root-package.json",
        generateBundle() {
          const srcPkg = require(`./packages/${dir}/package.json`);
          const pkg = {
            author: "Adam Laughlin <adam.laughlin@gmail.com>",
            license: "MIT",
            publishConfig: { access: "public" },
            ...srcPkg,
          };
          if (!("author" in srcPkg)) {
            writeFileSync(
              join(inDir, "package.json"),
              JSON.stringify(pkg, null, 2)
            );
          }

          // main es module with type commonjs is odd, but it seems to work
          // but https://2ality.com/2019/10/hybrid-npm-packages.html#option-3%3A-bare-import-esm%2C-deep-import-commonjs-with-backward-compatibility
          writeFileSync(
            join(outDir, "package.json"),
            JSON.stringify(
              {
                main: `./es/${dir}.js`,
                type: `commonjs`,
                // "module":`./es/${dir}.js`,
                // "browser": `./umd/${dir}.js`,
                ...pkg,
              },
              null,
              2
            )
          );
        },
      },
    ],
  }));
export default modules;
