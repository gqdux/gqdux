# GQdux

Simple, Redux-native GraphQL utilities optimized for developer speed.

## Philosophy

The rate we can build things depends on the number and topology of graphs we need to think about and change, from run-time flow control graphs (i.e., cyclomatic complexity) to developer past experience and language graphs (i.e., semiotic complexity), and others in between.  GQdux maximizes developer time per feature by minimizing the number of graphs to interact with.

Graphs it addresses:
flow control
semantic network
semiotic network (api size and language complexity)
component structure
parameter/argument tree
schema tree
data flow
module network
type network

## Incremental Adoptability
- Works alongside an existing redux implementation
- Leverage existing Redux knowledge, dev tools, and middleware  
- No Graphql server necessary. Use existing REST, RPC, Web Socket, and GraphQL server middleware. (though

## Assumptions

Currently, a normalized state, or way to normalize the state (e.g., normalizr).
GraphQL query knowledge (link to docs)
Redux knowledge

## Installing

no external dependencies
```shell
yarn add gqdux
# or 
npm install gqdux
```


## Quick Start ([Also on codepen](https://codepen.io/a-laughlin/pen/MWyVeYB?editors=0010))

```js
import {initGqdux} from 'https://unpkg.com/gqdux@0.0.31/es/gqdux.js';
import {createStore} from 'https://unpkg.com/redux@4.0.5/es/redux.mjs';
import {useState,useEffect,useMemo} from 'react'
import {render} from 'react-dom'

const schema = `
type Person{
  id:ID
  name:String
  friends:[Person]
}
`;
const initialState = {
  Person:{
    a:{id:'a',name:'A',friends:['b','c']},
    b:{id:'b',name:'B',friends:['c']},
    c:{id:'c',name:'C',friends:['a','b']}
  }
};

const {getGqdux,rootReducer,getSelectorHook}=initGqdux({schema});
const reduxStore=createStore(rootReducer,initialState);
const gqdux=getGqdux(reduxStore); // selects. If no selections requested, dispatches a mutating action
const useGqdux = getSelectorHook(reduxStore,useState,useEffect,gqdux);

// component
const Person=()=>
  <ul>{
    Object.values(
      useGqdux(`Person{id,name,friends{id,name}}`).Person
    ).map(p=>
          <li key={p.id}><pre>{JSON.stringify(p,null,2)}</pre></li>
         )
  }</ul>;


const Person_intersection_name_A = ()=>gqdux(`Person(intersection:{name:"A"})`);
const Person_subtract_id_a = ()=>gqdux(`Person(subtract:{id:"a"})`);
const Person_friends_subtract_id_b = ()=>gqdux(`Person(friends:{subtract:{id:"b"}})`);
// union gives the ability to add, but that transducer is not yet implemented
// custom transducers can do the same
render(
  <>
    <h1>Example</h1>    
    <button onClick={Person_friends_subtract_id_b}>
      Person_friends_subtract_id_b
    </button>
    <button onClick={Person_subtract_id_a}>
      Person_subtract_id_a
    </button>
    <button onClick={Person_intersection_name_A}>
      Person_intersection_name_{gqdux(`Person(intersection:"a"){name}`).Person.a.name}
    </button>
    <Person/>
    <a href=""
  </>,
  document.getElementById('app-root')
);
```

## API

initialization functions  [code link](https://github.com/gqdux/gqdux/blob/master/packages/gqdux/src/gqdux.js#L16)
```js
const {getGqdux,rootReducer,getSelectorHook}=initGqdux({
  schema,
  listTransducers={intersection, subtract, union}, // for use in queries. See see authoring transducers
  ... fns to control whether gqdux returns array or object collections
  
}); // initialization
const gqdux=getGqdux(reduxStore); // selects. If no selections requested, dispatches a mutating action
const useGqdux = getSelectorHook(reduxStore,React.useState,React.useEffect,gqdux); // a convenience fn to create a react hook from gqdux
```

query syntax
```js
// query  
gqdux`Person(intersect:{id:"a"}){id,friends{id}}` -> {a:{id:'a',friends:{b:{id:'b'},c:{id:'c'}}}}  

// collection mutation  
gqdux`Person(intersect:{id:"a"}` -> no data returned, but queries for Person get {...a}, (Person.b & Person.c removed)  

// prop mutation  
gqdux(`Person(friends:{subtract:{id:"b"}})`) -> no data returned. All persons with a friend b have that friend removed from their friend list

// In-Progress (to select a subset, then modify it)  
// prop mutation  
gqdux(`Person(intersect:{id:"a"},nicknames:{union:["AAAA"]})`) -> no data returned. Queries with Person.a get {...nicknames:["AA","AAA","AAAA"]}  
// prop mutation (shortcut
gqdux`Person(id:"a",friends:{intersect:{id:"b"}})`  
```  

## Affordances

Queries can return arrays or objects, depending on combiner and accumulator functions [passed to initGqdux](https://github.com/gqdux/gqdux/blob/master/packages/gqdux/src/gqdux.js#L19)  
```js
export const stubObject = () => ({});
export const stubArray = () => [];
export const appendArrayReducer = (acc = [], v) => {
  acc[acc.length] = v;
  return acc;
};
export const appendObjectReducer = (acc = {}, v, k) => {
  acc[k] = v;
  return acc;
};
```

## Constraints

Schema types map 1:1 with Redux state collections.  
Gqdux separates the graphql spec's query concerns from its network concerns.  
Middleware is responsible for parsing the queries and submitting network requests.  
A single reducer merges mutations, accepting flux standard action format created by gqdux: `{type:'mutation',payload:[query,variables]}`  
Transducers take the place of resolvers in async cases like network requests.  There is no need for resolvers in synchronous requests since gqdux uses the schema to auto-resolve queries.  
Loading states are considered a separate part of the state tree to stay relational.  Metadata would be stored in a separate collection, referenced by a nested property on the original schema type.  
Network requests should be handled by other tools, then updates made to the state tree.  gqdux doesn't need to know about network requests, only the state tree.  
## Authoring Transducers

There is no language outside set operations and the data tree
Transducers (currently intersection, subtraction, eventually union), operate on the 
Transducers have a similar signature to redux middleware.
They operate on collections and collection items.

6 nodeTypes map graphql schema types to redux state tree nodes: 
todo: make this a table with graphql schema and equivalent redux node  
scalar  
object  
objectId  
objectIdList  
objectObjectList  
objectScalarList 
in transducers, these appear as `schemaInfo.nodeType`
```js

export const intersection=(schemaInfo,args)=>
  next=>
    stateVal=>
      polymorphicListItemTest(schemaInfo,args)(stateVal) && next(stateVal));

export const subtract=(schemaInfo,args)=>
  next=>
    stateVal=>
      not(polymorphicListItemTest(schemaInfo,args))(stateVal) && next(stateVal));

export const union=(schemaInfo,args) =>
  next=> 
    stateVal=> {...more complex...};
```


## GQL Syntax (intentionally a subset)

// Graphql isn't designed as a data query language, but an API query language.  Attempts at making it one get [complicated](https://hasura.io/docs/1.0/graphql/manual/queries/query-filters.html#fetch-if-the-single-nested-object-defined-via-an-object-relationship-satisfies-a-condition).
To avoid semantic dependencies (that rely on developer past experience graphs), gqdux starts with standard set operations: Union, Intersect, and Subtract. (Difference).

## Testing

Testing all the combinations of a component is verbose and error prone.
Defining boundary values in the schema enables automatically testing each component using combinations of the values it queries for.
Gqdux leverages the graphql schema to enable testing all permutations of boundary values automatically.

TODO get this test working
```js
// assuming jest and jest-expect-message
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import gql from 'graphql-tag-bundled';

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

## Contributing

Write if there's interest

## Recipes

Converting the syntax to rest/graphql calls takes parsing the query.  The syntax is a subset of graphql currently, so it should work with existing graphql backends.

## GQL Differences
// converts query variable definitions array to an object, populating any relevant variables passsed
// default per spec is returning only what's in variableDefinitions
// this version provides the option to eliminate the duplicate definitions in each query to pass a variable
// given the def is often specified in the schema already.
