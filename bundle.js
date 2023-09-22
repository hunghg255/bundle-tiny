const fs = require('fs');

const path = require('path');

// js => ast
const { parse } = require("@babel/parser");

//
const traverse = require("@babel/traverse").default;

// AST => js text
const { transformFromAst } = require("@babel/core");

// Hash
let ID = 0;

function createAsset(fileName) {
  // read content
  const content = fs.readFileSync(fileName, 'utf-8');

  // content => ast
  const ast = parse(content, {
    sourceType: 'module'
  });

  // dependencies
  const dependencies = [];

  // ast => dependencies
  traverse(ast, {
    ImportDeclaration: ({
      node
    }) => {
      dependencies.push(node.source.value);
    }
  });

  // id
  const id = ID++;

  // ast => code
  const {
    code
  } = transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  });
console.log( {
  id,
  fileName,
  dependencies,
  code
});
  return {
    id,
    fileName,
    dependencies,
    code
  };
}

function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const queue = [mainAsset];

  // BFS => queue
  for (const asset of queue) {
    const dirname = path.dirname(asset.fileName);
    asset.mapping = {};

    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath);
      const child = createAsset(absolutePath);
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }

  return queue;
}

function bundle(graph) {
  let modules = '';

  graph.forEach(mod => {
    modules += `
      ${mod.id}: [
        function (require, module, exports) {
          ${mod.code}
        },
        ${JSON.stringify(mod.mapping)}
      ],
    `;
  });
console.log({modules});
  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(relativePath) {
          return require(mapping[relativePath]);
        }

        const module = { exports: {} };

        fn(localRequire, module, module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;

  return result;
}

const graph = createGraph('./entry.js');
console.log(graph);
const result = bundle(graph);
console.log(result);
