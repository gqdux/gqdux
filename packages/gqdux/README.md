# GQdux

Simple, Redux-native GraphQL utilities optimized for developer speed.

## Philosophy

The rate we can build things depends on the number and topology of graphs we need to think about and change, from run-time flow control graphs (i.e., cyclomatic complexity) to developer past experience and language graphs (i.e., semiotic complexity), and others in between.  GQdux maximizes developer time per feature by minimizing the number of graphs to interact with.

Graphs it addresses:
flow control
semantic network
semiotic network
component structure
inheritance tree
scope tree
state tree
parameter/argument tree
schema tree
data flow
module network
type network

Incremental Adoptability

- Leverage existing Redux knowledge, dev tools, and middleware  
- No Graphql server necessary. Use existing REST, RPC, Web Socket, and GraphQL server middleware.
- Flexible property partitioning - send only what each server needs

Concerns Separation

## Constraints

- constraints:
  - always creates a collection for objects:
    - We often start with a single object, and need a list of them. Starting with a list is more flexible.
    - We can do anything with 1-length list that we can with a single object
    

## Installing

## Quick Start (Redux Only)

```js
import {createStore} from 'redux';
import {initReducer,initGqdux} from 'gqdux';

const schema=`
  type Person{id:ID,name:String,best:Person,otherbest:Person,nicknames:[String],friends:[Person],pet:Pet}
  type Pet{id:ID,name:String}
  scalar SomeScalar
`;

const initialState = {
  a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
  b:{id:'b',name:'B',best:'a',friends:['a'],nicknames:["BB","BBB"]},
  c:{id:'c',name:'C',best:'b',friends:['b'],nicknames:[]},
};

const {gqdux:g} = initGqdux({gql,schema,store:createStore(initReducer(schema),initialState)});


// mutation
Collection                  g`Person(intersection:{id:"a"})`
Prop                        g`Person(friends:{intersect:{id:"b"}})`
//
// query
Collection                  g`Person(intersect:{id:"a"}){id,friends{id}}`
```

Try it [on codepen](link)

## Quick Start (Redux + React)

## TODO

- set up build with snowpack
- convert select to use the query tree instead of a separate walk
- make selectPath always return a list for lists, not condense down single objects
- dispatch >1 change in batch
- decide where domain concept components should go
- decide where derivations should go
- Type checking in development
- Sort transducer

## API


`gqdux('Person{id}',{...variables...})` equivalents: redux selector, graphql query
`selectFullPath('graphql string',{...variables...})` equivalents: redux selector, graphql query 
`change('graphql string',{...variables...})` equivalents: redux selector, graphql query 
`selectorToReactHook`

## GQL Syntax (intentionally a subset)

// Graphql isn't designed as a data query language, but an API query language.  Attempts at making it one get [complicated](https://hasura.io/docs/1.0/graphql/manual/queries/query-filters.html#fetch-if-the-single-nested-object-defined-via-an-object-relationship-satisfies-a-condition).
In the #pitofsuccess spirit, I provide a few standard terms
I don't know the best solution for this (it likely varies), but I do know having something simple and robust enough to cover many cases is helpful to get started.  To avoid semantic dependencies (that rely on developer past experience graphs), I'm going with standard set operations: Union, intersection, and Subtraction (Difference).

### Operations (3)

Standard set operations for simplicity and to minimize mismatch between author and user linguistic/experiential dependency graphs

- intersect
- union
- subtract

### Operation Syntax (2 ways to use)

```js
import {createStore} from 'redux';
import {initReducer,initGqdux} from 'gqdux';

const {gqdux:g} = initGqdux({gql,schema,store:createStore(initReducer(schema))});

// mutation
Collection                  g`Person(intersect:{id:"a"})`
Prop                        g`Person(friends:{intersect:{id:"b"}})`
```

### Select/Change Syntax (2)

change(`Person(intersect:{id:"a"})`)
select(`Person(intersect:{id:"a"}){id,friends}`)


### Examples

TODO

## Testing

Testing all the permutations of a component is both verbose and error prone.
Gqdux leverages the graphql schema to enable testing all permutations of boundary values automatically.

TODO get this test working
```js
// assuming jest and jest-expect-message
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import gql from 'graphql-tag-bundled';

import {schemaToRootReducer,getSelectPath,mapBoundaryValueCombinations} from 'gqdux';
import {createStore} from 'redux';
import {useState,useEffect} from 'react';

const schema=gql`
  type Person {
    id:ID         @boundaryValues:[123]
    name:String   @boundaryValues:["","foooo", "dfasdfasdfasdfasdfasdfasdfasdfasdfee fwe wej we rwer e rejrq wejr The Third"]
    pet:Pet
  }
  type Pet {
    id:ID         @boundaryValues:[123]
    name:String   @boundaryValues:["","baaaar", "really long name"]
  }
`
const store = createStore(schemaToRootReducer(schema));
const change = schemaToChangePublisher(schema,store);
const selectPath = getSelectPath(schema,gql,store);
const schemaToEachBoundaryValueCombination=(schema)=>(gqlStr,callback)=>{
  queryToBoundaryValueSelectionList(schema,query).forEach(callback);
}
const eachBoundaryValueCombination = schemaToEachBoundaryValueCombination(schema);
const GreetHuman = ()=>{
  const {name,petName}=selectPath('Person(id:"a"){name,pet{name}}');
  <div>{`Hello, ${name}, and your little dog ${petName}!`}</div>
};
const GreetPet = ({name=''})=><div>{`Hello, ${name}, and your little dog ${petName}!`}</div>;
test('it does stuff',()=>{
  // change(`{Person(id:"a",union:{name:${name},pet:${pet}}})}`)
  eachBoundaryValueCombination('Person(id:"a"){name,pet{name}}',({name,pet:petName})=>{
    const { container, getByText } = render(<GreetHuman />);
    act(()=>{change(`Person(id:"a",union:{name:${name},pet:${petName}}})}`));
    expect(getByText(`Hello, ${name}, and your little dog ${petName}!`)).toBeInTheDocument()
    if(name.length===0) expect(result)id===expect(result)
  });
})
```

## Prior Work

Redux
Graphql
Apollo, Urql

## Escape Hatches

Action creators
Writing custom operations

## Contributing

Write if there's interest

## Recipes

Existing redux patterns mostly apply.  The only difference is in parsing action names.  

## GQL Differences
// converts query variable definitions array to an object, populating any relevant variables passsed
// default per spec is returning only what's in variableDefinitions
// this version provides the option to eliminate the duplicate definitions in each query to pass a variable
// given the def is often specified in the schema already.
