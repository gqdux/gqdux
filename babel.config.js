// module.exports = api => {
//   // this is for jest to work with es modules
//   // jest sets env.test
//   // You can use api.env('test') to determine what presets and plugins to use.
//   return !api.env('test') ? {} : {
//     "presets": [["@babel/preset-env", {"targets":{"node":"current"}}]],
//   };
//   // for dynamic imports
//   // "plugins": ["dynamic-import-node"]
//   // "env": {
//   //   "test": {
//   //     "plugins": ["dynamic-import-node"]
//   //   }
//   // }
// };
module.exports = {
  // this is for jest to work with es modules
  // jest sets env.test
  // You can use api.env('test') to determine what presets and plugins to use.
  env:{
    test:{
      presets:[[
        "@babel/preset-env",
        {targets:{node:"current"}}
      ]]
    }
  }
  // for dynamic imports
  // "plugins": ["dynamic-import-node"]
  // "env": {
  //   "test": {
  //     "plugins": ["dynamic-import-node"]
  //   }
  // }
};
