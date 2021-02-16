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
import {initGqdux} from 'gqdux';

const schema=`
type Person{
  id:ID,
  name:String,
  best:Person,
  otherbest:Person,
  nicknames:[String],
  friends:[Person],
  pet:Pet
}
`;

const initialState = {
  Person:{
    a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
    b:{id:'b',name:'B',best:'a',friends:['a'],nicknames:["BB","BBB"]},
    c:{id:'c',name:'C',best:'b',friends:['b'],nicknames:[]},
  }
};

const {getGqdux,rootReducer}=initGqdux({schema});
const reduxStore=createStore(rootReducer,initialState);
const gqdux=getGqdux(reduxStore);

// query
gqdux`Person(intersect:{id:"a"}){id,friends{id}}` -> {a:{id:'a',friends:{b:{id:'b'},c:{id:'c'}}}}

// collection mutation
gqdux`Person(intersection:{id:"a"}` -> no data returned, but queries for Person get {...a}, (Person.b & Person.c removed)

// prop mutation
gqdux(`Person(intersection:{id:"a"},nicknames:{union:["AAAA"]})`) -> no data returned. Queries with Person.a get {...nicknames:["AA","AAA","AAAA"]}

// In-Progress (to select a subset, then modify it)
Collection+Prop             gqdux`Person(intersection:{id:"a"},friends:{intersect:{id:"b"}})`
Collection+Prop (shortcut)  gqdux`Person(id:"a",friends:{intersect:{id:"b"}})`

```

Try it [on codepen](link)

## Authoring Transducers

```js


export const intersection=(meta,args)=>next=>obj=>polymorphicListItemTest(meta,args)(obj) && next(obj));

export const intersection=(meta,args) => next => obj => not(polymorphicListItemTest(meta,args))(obj) && next(obj));

export const union=(args={},meta) => next => obj => {...more complex...};
```


## Quick Start (Redux + React)

## API

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
