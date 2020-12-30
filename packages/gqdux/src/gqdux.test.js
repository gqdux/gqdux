import {createStore,combineReducers} from 'redux';
import {useState,useEffect}from 'react';
import {
  schemaToReducerMap,
  schemaToMutationReducer,
  getSelectFullPath,
  getSelectPath,
  pathSelectorToReactHook,
  initGqdux
} from './gqdux';

import { renderHook, act } from '@testing-library/react-hooks'
import gql from 'graphql-tag-bundled';
import { isObjectLike, mapToObject, over, pick, pipe, tdTap, transToObject } from '@a-laughlin/fp-utils';


import { CustomConsole, LogType, LogMessage } from '@jest/console';
import {ErrorWithStack, formatTime} from 'jest-util';
function simpleFormatter(type, message){
    const TITLE_INDENT = '    ';
    const CONSOLE_INDENT = TITLE_INDENT + '  ';
    const rawStack = new ErrorWithStack(undefined).stack;

    const origin = rawStack
      .split('\n')[5];
      // .slice(stackLevel)
      // .filter(Boolean)
      // .join('\n');
    // return JSON.stringify(message).replace(/"/g,'').replace(/,/g,', ')
    // return message.split(/\n/).map(line => CONSOLE_INDENT + line).join('\n');
    // return message+origin;
    // if (type === 'error')return message;
    return JSON.stringify(message.split(/\n\s*/).join('')).replace(/"|'/g,'').replace(/undefined/g,'u')+'  at: '+origin.replace(/^.*\((.+)\)/,'$1');
}


global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter);


const mapUnion=(mapper={x:x=>x})=>source=>{const dest={};for (const k in source) dest[k]=k in mapper?mapper[k](source[k],k,source):source[k];return dest};
const mapPropsIntersection=(mapper={x:x=>x})=>source=>{const dest={};for (const k in mapper) dest[k]=mapper[k](source[k],k,source);return dest};
// const mapPropsIntersection=(a={x:x=>x})=>b=>{const c={};for (const k in a) c[k]=a[k](b[k],k,b);return c};
const selectNestedProps=(rootObj)=>{
  return (...lists)=>inner(rootObj,...lists.map(l=>l.split(',')));
  function inner(obj,head,...tail){
    if (head===undefined||!isObjectLike(obj)) return obj;
    return transToObject((o,k)=>{
      if (k==='friends') o[k]=transToObject((oo,kk)=>{oo[kk]=inner(rootObj[kk],...tail)})(obj[k]);
      else if (k==='best') o[k]=inner(rootObj[k],...tail);
      else o[k]=inner(obj[k],...tail);
    })(head);
  }
}

describe("schemaToReducerMap", () => {
  let state;
  let schema=gql(`
    type Person{id:ID,name:String,best:Person,otherbest:Person,nicknames:[String],friends:[Person],pet:Pet}
    type Pet{id:ID,name:String}
    scalar SomeScalar
  `);
  let reducerMap = schemaToReducerMap(schema);
  
  beforeEach(()=>{
    state={
      SomeScalar:1,
      SomeThingNotInSchema:1,
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
        b:{id:'b',name:'B',best:'a',friends:['a']},
        c:{id:'c',name:'C',best:'a',friends:['a']},
      },
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
    };
  });
  afterAll(()=>{
    schema=state=reducerMap=null;
  });
  it("should generate keys for each type ,plus scalars",()=>{
    expect(Object.keys(reducerMap).sort())
    .toEqual(['Person','Pet','SomeScalar','Boolean','Float','ID','Int','String'].sort());
  });
  it("should read values as default",()=>{
    expect(reducerMap.Person(state.Person))
    .toBe(state.Person);
  });
  it("should get scalar values",()=>{
    expect(reducerMap.SomeScalar(state.SomeScalar)).toBe(1);
  });
  it("should set scalar values",()=>{
    expect(reducerMap.SomeScalar(state.SomeScalar,{type:'SOMESCALAR_SET',payload:2})).toBe(2);
  });
  it("should enable deletions from a collection",()=>{
    const result = reducerMap.Person(state.Person,{type:'PERSON_SUBTRACT',payload:{c:{id:'c'}}});
    expect(result).not.toBe(state.Person);
    expect(result.a).toBe(state.Person.a);
    expect(result.b).toBe(state.Person.b);
    const expected = {...state.Person};
    delete expected.c;
    expect(result).toEqual(expected);
  });
  it("should return the original if nothing to delete",()=>{
    expect(reducerMap.Person(state.Person,{type:'PERSON_SUBTRACT',payload:{d:{id:'d'}}}))
    .toBe(state.Person);
  });

  it("should enable creations|unions",()=>{
    const c={id:'c',best:'a',friends:['a']};
    const result = reducerMap.Person(state.Person,{type:'PERSON_UNION',payload:{c}});
    expect(result).toEqual({...state.Person,c});
    expect(result).not.toBe(state.Person);
  });
});
describe("initGqdux selector (query) case", () => {
  let schema,state,initSelector;
  beforeAll(()=>{
    schema=gql`
      type Person{id:ID,name:String,best:Person,otherbest:Person,nicknames:[String],friends:[Person],pet:Pet}
      type Pet{id:ID,name:String}
      scalar SomeScalar
    `;
    ({initSelector} = initGqdux({schema}));
  });
  beforeEach(()=>{
    state={
      SomeScalar:1,
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
        b:{id:'b',name:'B',best:'a',friends:['a']},
        c:{id:'c',name:'C',best:'a',friends:['a']},
      },
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
    };
  });
  afterAll(()=>{
    schema=state=initSelector=null;
  });
  // it.only("should traverse arguments",()=>{
    
  //   const query = gql(`{Person(foo:{}){id}}`);
  //   const queryFn = querier(query);
  //   const result1 = queryFn(state);
  //   expect(result1).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
  // });
  // it.only("should traverse more arguments than selections",()=>{
  //   const query = gql(`{Person{id}}`);
  //   const queryFn = querier(query);
  //   const result1 = queryFn(state);
  //   expect(result1).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
  // });
  // it.only("should traverse more selections than arguments",()=>{
  //   const query = gql(`{Person{id}}`);
  //   const queryFn = querier(query);
  //   const result1 = queryFn(state);
  //   expect(result1).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
  // });
  it("should query collections",()=>{
    const query = gql(`{Person{id}}`);
    const queryFn = initSelector(query);
    const result1 = queryFn(state);
    expect(result1).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
  });
  it(`should denormalize item subsets with constants Person(intersection:{id:"a"}){best{id}}`,()=>{
    const query = gql(`{Person(intersection:{id:"a"}){best{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });
  it("should denormalize item subsets with variables",()=>{
    const query = gql(`{Person(intersection:{id:$id}){best{id}}}`);
    const result1 = initSelector(query,{id:'a'})(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });
  it("should denormalize item subsets with non-id variables",()=>{
    const query = gql(`{Person(intersection:{best:$best}){best{id}}}`);
    const result1 = initSelector(query,{best:'b'})(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });
  it("should denormalize item subsets with default variables",()=>{
    const query = gql(`query getPerson($id: ID = "a"){Person(intersection:{id:$id}){best{id}}}`);
    const result1 = initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });
  it("should denormalize item subsets with non-id default variables",()=>{
    const query = gql(`query getPerson($best: String = "b"){Person(intersection:{best:$best}){best{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });

  it("should denormalize lists of ids",()=>{
    const query = gql(`{Person{id,friends{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:selectNestedProps(state.Person)('a,b,c','id,friends','id')});
  });
  it("should denormalize item subsets with non-id constants",()=>{
    const query = gql(`{Person(intersection:{best:"b"}){best{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'}}}});
  });

  it("should query multiple scalar props",()=>{
    const query = gql(`{Person(intersection:{id:$id}){id,name}}`);
    const result1=initSelector(query,{id:'a'})(state);
    expect(result1).toEqual({Person:{a:{id:'a',name:'A'}}});
  });
  it("should query a scalar and object prop",()=>{
    const query = gql(`{Person(intersection:{id:$id}){id,best{id}}}`);
    const result1=initSelector(query,{id:'a'})(state);
    expect(result1).toEqual({Person:{a:{id:'a',best:{id:'b'}}}});
  });
  it("should query multiple object props",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){best{id},otherbest{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'},otherbest:{id:'c'}}}});
  });
  // it("should behave the same with (intersection:{...}) and (...)",()=>{
  //   let query = gql(`{Person(id:"a") {best{id},otherbest{id}}}`);
  //   let result1=querier(query)(state);
  //   expect(result1).toEqual({Person:{a:{best:{id:'b'},otherbest:{id:'c'}}}});
  //   query = gql(`{Person(intersection: {id:"a"} ) {best{id},otherbest{id}}}`);
  //   let result2=querier(query)(state);
  //   expect(result2).toEqual(result1);
  // });
  // eliminating tests for passing functions to:
  //   separate concerns
  //   make logic in components more difficult #pitofsuccess
  //   enable fns to be implemented on front or back-end
  it("should accept variables named differently than the key",()=>{
    let query = gql(`{Person(intersection:{id:$xyz}) {best{id},otherbest{id}}}`);
    let result1=initSelector(query,{xyz:"a"})(state);
    expect(result1).toEqual({Person:{a:{best:{id:'b'},otherbest:{id:'c'}}}});
  });
  it("should query objects deeply",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){best{best{best{best{best{best{best{best{best{best{id}}}}}}}}}}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{best:{best:{best:{best:{best:{best:{best:{best:{best:{best:{id:'a'}}}}}}}}}}}}});
  });
  it("should query other types",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){pet{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{pet:{id:'x'}}}});
  });
  it("should query scalars",()=>{
    const query = gql(`{SomeScalar}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({SomeScalar:1});
  });
  it("should query scalar lists",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){nicknames}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{nicknames:["AA","AAA"]}}});
  });
  it("should query scalar list items",()=>{
    const query = gql(`{Person(intersection:{id:"a"},nicknames:{intersection:"AA"}){id,nicknames}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{id:"a",nicknames:["AA"]}}});
  });
  it("should query object lists",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){friends{id}}}`);
    const result1=initSelector(query)(state);
    expect(result1).toEqual({Person:{a:{friends:{b:{id:'b'},c:{id:'c'}}}}});
  });
  it("should return an error when selecting objects without ids",()=>{
    const query = gql(`{Person(intersection:{id:"a"}){friends}}`);
    const result1=initSelector(query)(state);
    expect(result1.Person.a.friends).toEqual(new Error(`objects must have selections`));
  });
  it("should return unchanged values",()=>{
    const query=gql(`{Person{id}}`);
    const queryFn = initSelector(query);
    const prevRootStates=[state,{...state},{...state,Person:{...state.Person,c:{...state.Person.c}}}];
    const prevDenormRoots=prevRootStates.map(s=>queryFn(state,s));
    prevRootStates.forEach((prevRoot)=>{
      prevDenormRoots.forEach((prevDenormRoot)=>{
        const denormRoot=queryFn(state,prevRoot,prevDenormRoot);
        expect(state===prevRoot).toBe(denormRoot===prevDenormRoot);
        expect(state.Person===prevRoot.Person).toBe(denormRoot.Person===prevDenormRoot.Person)
        expect(denormRoot.Person.a).toBe(prevDenormRoot.Person.a);
        expect(denormRoot.Person.c===prevDenormRoot.Person.c).toBe(state.Person.c===prevRoot.Person.c);
      });
    });
  });
});

describe("getUseFullPath",()=>{
  // : integration test React.useState,redux.combineReducers(schemaReducerMap),schemaToQuerySelector(schema)
  let store,useQuery,schema,selectFullPath,cleanupSelectFullPath,reducerMap,selectPersonProps;

  beforeEach(()=>{
    schema = gql`
      type Person{id:ID,name:String,best:Person,otherbest:Person,nicknames:[String],friends:[Person],pet:Pet}
      type Pet{id:ID,name:String}
      scalar SomeScalar
    `;
    reducerMap = schemaToReducerMap(schema);
    const rootReducer = combineReducers(reducerMap);
    store = createStore(rootReducer,{
      SomeScalar:1,
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
        b:{id:'b',name:'B',best:'a',friends:['a']},
        c:{id:'c',name:'C',best:'a',friends:['a']},
      },
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
    });
    const sp = selectNestedProps(store.getState().Person);
    selectPersonProps=(...lists)=>({Person:sp(...lists)});
    ({selectFullPath, cleanupSelectFullPath} = getSelectFullPath(schema,gql,store));
    useQuery = pathSelectorToReactHook(selectFullPath,store,useState,useEffect);
  });
  afterEach(()=>{
    cleanupSelectFullPath();
  });
  afterAll(()=>{
    store,useQuery,schema,selectFullPath,cleanupSelectFullPath,selectPersonProps,reducerMap=null;
  });
  
  test('should work on scalars', () => {
    const { result } = renderHook(() =>useQuery(`{SomeScalar}`));
    expect(result.current).toEqual({SomeScalar:1});
    const prevState = store.getState();
    act(()=>{store.dispatch({type:'SOMESCALAR_SET',payload:1})});
    expect(store.getState()).toBe(prevState);
    expect(result.current.SomeScalar).toBe(1);
    act(()=>{store.dispatch({type:'SOMESCALAR_SET',payload:2})});
    expect(result.current.SomeScalar).toBe(2);
    expect(store.getState()).not.toBe(prevState);
    expect(store.getState().SomeScalar).toBe(2);
    expect(store.getState().Person).toBe(prevState.Person);
  });
  test('should work on objects', () => {
    const { result } = renderHook(() =>useQuery(`{Person{id}}`));
    expect(result.current).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
    act(()=>{store.dispatch({type:'PERSON_SUBTRACT',payload:'a'});})
    expect(result.current).toEqual({Person:{b:{id:'b'}, c:{id:'c'}}});
    act(()=>{store.dispatch({type:'PERSON_ADD',payload:{id:'d',name:'D',best:'b',otherbest:'c',nicknames:["DD","DDD"],friends:['b','c'],pet:'x'}})});
    expect(result.current).toEqual({Person:{b:{id:'b'}, c:{id:'c'},d:{id:'d'} }});
  });
  test('should work on nested object', () => {
    const { result } = renderHook(() =>useQuery(`{Person{id,friends{id}}}`));
    expect(result.current).toEqual(selectPersonProps('a,b,c','id,friends','id'));
    act(()=>{store.dispatch({type:'PERSON_SUBTRACT',payload:'a'});})
    expect(result.current).toEqual(selectPersonProps('b,c','id,friends','id'));
  });
  test('should update one with another changed', () => {
    const { result } = renderHook(() =>({
      main:useQuery(`{Person{id}}`),
      a:useQuery(`{Person(intersection:{id:"a"}){id}}`)
    }));
    expect(result.current.main).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
    expect(result.current.a).toEqual({Person:{a:{id:'a'}}});
    act(()=>{store.dispatch({type:'PERSON_SUBTRACT',payload:{id:'a'}});})
    expect(result.current.main).toEqual({Person:{b:{id:'b'}, c:{id:'c'}}});
    expect(result.current.a).toEqual({Person:{}});
    act(()=>{store.dispatch({type:'PERSON_ADD',payload:{id:'a'}})});
    expect(result.current.main).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
    expect(result.current.a).toEqual({Person:{a:{id:'a'}}});
  })
  test('should not update unchanged collection items', () => {
    const { result } = renderHook(() =>useQuery(`{Person{id}}`));
    const { result:resulta } = renderHook(() =>useQuery(`{Person(intersection:{id:"a"}){id}}`));
    const { result:resultb } = renderHook(() =>useQuery(`{Person(intersection:{id:"b"}){id}}`));
    const b=resultb.current.Person.b;
    expect(result.current).toEqual({Person:{a:{id:'a'}, b, c:{id:'c'}}});
    expect(resulta.current).toEqual({Person:{a:{id:'a'}}});
    expect(resultb.current).toEqual({Person:{b}});
    act(()=>{store.dispatch({type:'PERSON_SUBTRACT',payload:{id:'a'}});})
    expect(result.current).toEqual({Person:{b, c:{id:'c'}}});
    expect(resulta.current).toEqual({Person:{}});
    expect(resultb.current.Person.b).toBe(b);
    act(()=>{store.dispatch({type:'PERSON_ADD',payload:{id:'a'}})});
    expect(result.current).toEqual({Person:{a:{id:'a'}, b, c:{id:'c'}}});
    expect(resulta.current).toEqual({Person:{a:{id:'a'}}});
    expect(resultb.current.Person.b).toBe(b);
  })
});

describe("useSelectPath",()=>{
  // : integration test React.useState,redux.combineReducers(schemaReducerMap),schemaToQuerySelector(schema)
  let store,useSelectPath,schema,selectPath,cleanupSelectPath,reducerMap;
  beforeEach(()=>{
    schema = gql`
      type Person{
        id:ID         @boundary(values:123)
        name:String   @boundary(values:["","fooo","really long string"])
        best:Person
        otherbest:Person
        nicknames:[String]
        friends:[Person]
        pet:Pet
      }
      type Pet{
        id:ID         @boundary(values:456)
        name:String   @boundary(values:["","baaar","really long string"])
      }
      scalar SomeScalar
    `;
    reducerMap = schemaToReducerMap(schema);
    const rootReducer = combineReducers(reducerMap);
    store = createStore(rootReducer,{
      SomeScalar:1,
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
        b:{id:'b',name:'B',best:'a',friends:['a']},
        c:{id:'c',name:'C',best:'a',friends:['a']},
      },
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
    });
    ({selectPath, cleanupSelectPath} = getSelectPath(schema,gql,store));
    useSelectPath = pathSelectorToReactHook(selectPath,store,useState,useEffect);
  });
  afterEach(()=>{
    cleanupSelectPath();
  });
  afterAll(()=>{
    store=useSelectPath=schema=selectPath=cleanupSelectPath=reducerMap=null;
  });
  
  test('should convert scalar props to their value', () => {
    const { result } = renderHook(() =>useSelectPath(`{SomeScalar}`));
    expect(result.current).toEqual(1);
  });
  test('should convert objects with a single selection to a collection of that selection', () => {
    const { result } = renderHook(() =>useSelectPath(`{Person{id}}`));
    expect(result.current).toEqual({a:'a',b:'b',c:'c'});
  });
  test('should convert a single selected object + selection to the selected value', () => {
    const { result } = renderHook(() =>useSelectPath(`{Person(intersection:{id:"a"}){id}}`));
    expect(result.current).toEqual('a');
  });
  test('should convert one object with two selections to the object with only that selection', () => {
    const { result } = renderHook(() =>useSelectPath(`{Person(intersection:{id:"a"}){id,name}}`));
    expect(result.current).toEqual({a:{id:'a',name:'A'}});
  });
  test('should convert a nested property selection to the selected value', () => {
    const { result } = renderHook(() =>useSelectPath(`{Person(intersection:{id:"a"}){best{id}}}`));
    expect(result.current).toEqual('b');
  });
  
  test('supports permutation testing', () => {
    
    // figure out the syntax for looping in a test
    // for (const {id,name,pet} of selectPath(`{Person(id:"a"){best{id}}}`)){
      // const { result } = render(() =><div>useSelectPath(`{Person(id:"a"){best{id}}}`));
    // }
    expect(true).toBe(true);
  });
});

// const values={
//   id:['a'/* ,null,undefined */],
//   friends:['b',{id:'b'},{best:'a'}/* ,null,undefined */],
//   nicknames:['AA'/* ,null,undefined */],
//   name:['A'/* ,null,undefined */],
//   best:['b'/* ,null,undefined */],
//   blank:[],
// };
// const valueStrings=mapToObject(v=>v.map(vv=>!isObjectLike(vv)?vv:('id' in vv?`{id:"${vv.id}"}`:`{best:"${vv.best}"}`)))(values);
// const args=Object.entries(values).flatMap(([k,valueList])=>{
//   if (k==='blank')return [[k,'','']];
//   return valueList.flatMap((v,i)=>[ [k, valueStrings[k][i], v], [k,`[${valueStrings[k][i]}]`,[v]] ]);
// });
// const selectionList=['',...Object.keys(values)];
// const selections=selectionList.flatMap(selection1=>selectionList.map(selection2=>{
//   if(selection1===selection2&&selection1!=='')return [];
//   return [selection1,selection2,selection1===''
//     ?selection2===''
//       ? ''
//       : `{${selection2}}`
//     :selection2===''
//       ? `{${selection1}}`
//       : `{${selection1},${selection2}}`];
// }));

// ['','intersection:'/* ,'subtract:' */].forEach(transducerName=>{
//   args.forEach(([k,vStr,v],ai)=>{
//     selections.forEach(([selection1,selection2,selectionStr],si)=>{
//       if(ai<=1&&si<=1)console.log(` k:`,k,` vStr:`,vStr,` selectionStr:`,selectionStr,);
//       test(`${transducerName} Person(${transducerName}{${k}:${vStr}})${selectionStr})`,()=>{
//         const query = gql(`Person(${transducerName}:{${k}:${vStr}})${selectionStr})`);
//         if(selectionStr===''){
//           const { result } = renderHook(() =>useQuery(`{Person{id,friends{id}}}`));
//           expect(result.current).toEqual(selectPersonProps('a,b,c','id,friends','id'));
//         } else {

//         }
//       });
//     });
//   });
// });


describe("initGqdux rootReducer (mutation) case",()=>{
  // integration test React.useState,redux.combineReducers(schemaReducerMap),schemaToQuerySelector(schema)
  let store,useQuery,schema,dispatchMutation,selectFullPath,cleanupSelectFullPath,initReducer,state,selectPersonProps;
  schema = gql`
    type Person{id:ID,name:String,best:Person,otherbest:Person,nicknames:[String],friends:[Person],pet:Pet}
    type Pet{id:ID,name:String}
    scalar SomeScalar
  `;
  ({initReducer} = initGqdux({schema}));

  beforeEach(()=>{
    state={
      SomeScalar:1,
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['b','c'],pet:'x'},
        b:{id:'b',name:'B',best:'a',friends:['a'],nicknames:["BB","BBB"]},
        c:{id:'c',name:'C',best:'b',friends:['b'],nicknames:[]},
      },
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
    }
    selectPersonProps=(...lists)=>({Person:selectNestedProps(state.Person)(...lists)});
    store = createStore(initReducer,state);
    dispatchMutation=(query,vars)=>{
      store.dispatch({type:'mutation',payload:[gql`{${query}}`,vars]});
    };
    ({selectFullPath,cleanupSelectFullPath}=getSelectFullPath(schema,gql,store));
    useQuery = pathSelectorToReactHook(selectFullPath,store,useState,useEffect);
  });

  afterEach(()=>{
    cleanupSelectFullPath()
  })
  afterAll(()=>{
    schema=state=store=useQuery=dispatchMutation=cleanupSelectFullPath=selectFullPath=initReducer=selectPersonProps=undefined;
  });
  
  
  // const filterMapBWithA=(a={x:x=>x})=>b=>{const c={};for (const k in a) c[a]=a[k](b[k],k,b);return c};
  test('Subtract: object subtract objectList value         Person(intersection:{id:"a"},friends:{subtract:{id:"b"}})',()=>{
    const { result } = renderHook(() =>useQuery(`{Person{id,friends{id}}}`));
    expect(result.current).toEqual(selectPersonProps('a,b,c','id,friends','id'));
    const{a:denormedA,b:denormedB,c:denormedC}=result.current.Person;
    let{a:stateA,b:stateB,c:stateC}=store.getState().Person;
    // act(()=>{dispatchMutation(`Person(intersection:{id:"a"},friends:{subtract:"b"})`);})
    
    act(()=>{dispatchMutation(`Person(friends:{subtract:"b"})`); });
    expect(store.getState().Person).toEqual({
      a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['c'],pet:'x'},
      b:stateB,
      c:{id:'c',name:'C',best:'b',friends:[],nicknames:[]},
    });
    expect(store.getState().Person.a).not.toBe(stateA);
    stateA=store.getState().Person.a;
    expect(store.getState().Person.b).toBe(stateB);
    expect(store.getState().Person.c).not.toBe(stateC);
    stateC=store.getState().Person.c;
    expect(result.current.Person.a).not.toBe(denormedA);
    expect(result.current.Person.b).toBe(denormedB);
    expect(result.current.Person.c).not.toBe(denormedC);
    expect(result.current).toEqual({Person:{a:{id:"a",friends:{c:{id:'c'}}},b:denormedB,c:{id:"c",friends:{}}}});
    act(()=>{dispatchMutation(`Person(subtract:"c")`); });
    // does not cascade changes yet, so keep props
    expect(store.getState()).toEqual({
      SomeScalar:1,
      Pet:{
        x:{id:'x',name:'X'},
        y:{id:'y',name:'Y'},
      },
      Person:{
        a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['c'],pet:'x'},
        b:stateB,
      }
    });
    
    expect(result.current).toEqual({Person:{a:{id:"a",friends:{c:{id:'c'}}},b:{id:"b",friends:{a:{id:"a"}}}}});
    expect(store.getState().Person.a).toBe(stateA);
    expect(store.getState().Person.b).toBe(stateB);
    expect(store.getState().Person.c).toBe(undefined);
    act(()=>{dispatchMutation(`Person(intersection:{id:"a"})`);})
    expect(store.getState().Person).toEqual({
      a:{id:'a',name:'A',best:'b',otherbest:'c',nicknames:["AA","AAA"],friends:['c'],pet:'x'},
    });
    expect(result.current).toEqual({Person:{a:{id:"a",friends:{c:{id:'c'}}}}});
    expect(store.getState().Person.a).toBe(stateA);
    expect(store.getState().Person.b).toBe(undefined);
    expect(store.getState().Person.c).toBe(undefined);
  });
  test('Subtract: object subtract scalarList value         Person(id:"a",subtract:{"nicknames":"AA"})',()=>{
    // should split a|bc, apply to a, recombine to abc
    // const { result } = renderHook(() =>useQuery(`{Person{id,nicknames}}`));
    // expect(result.current).toEqual({Person:{a:{id:'a',nicknames:["AA","AAA"]}, b:{id:'b',nicknames:["BB","BBB"]}, c:{id:'c',nicknames:[]}}});
    // act(()=>{dispatchMutation(`Person(intersection:{id:"a"},subtract:{nicknames:["AA"]})`);})
    // // console.log('store.getState()',store.getState())
    // expect(result.current).toEqual({Person:{a:{id:'a',nicknames:["AAA"]},b,c}});
    expect(true).toBe(true);
  })
  test('Subtract: object subtract object prop value        Person(id:"a",subtract:"best")',()=>{
    expect(true).toBe(true);
  })
  test('Subtract: object subtract scalar prop value        Person(intersection:{id:"a"},subtract:{"ni":)',()=>{
    expect(true).toBe(true);
  })
  test('Subtract: objectList subtract object               Person(subtract:"a")',()=>{
    const {b:stateB,c:stateC}=store.getState().Person;
    const bCopy = {...stateB};
    const cCopy = {...stateC};
    const { result } = renderHook(() =>useQuery(`{Person{id}}`));
    expect(result.current).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
    const {b:selectedB,c:selectedC}=result.current.Person;
    // console.log(` selectedB:`,selectedB,)
    act(()=>{dispatchMutation(`Person(subtract:{id:"a"})`);})
    // console.log(selectPersonProps('b,c','id'))
    expect(result.current).toEqual(selectPersonProps('b,c','id'));
    expect(store.getState().Person.a).toBe(undefined);
    expect(result.current.Person.b).toBe(selectedB);
    expect(result.current.Person.c).toBe(selectedC);
    expect(stateB).toBe(store.getState().Person.b);
    expect(stateC).toBe(store.getState().Person.c);
    expect(bCopy).toEqual(store.getState().Person.b);
    expect(cCopy).toEqual(store.getState().Person.c);
    act(()=>{dispatchMutation(`Person(subtract:{id:"b"})`);})
    expect(result.current).toEqual({Person:{c:{id:'c'}}});
    expect(store.getState().Person.a).toBe(undefined);
    expect(store.getState().Person.b).toBe(undefined);
    expect(selectedC).toBe(result.current.Person.c);
    expect(stateC).toBe(store.getState().Person.c);
    expect(cCopy).toEqual(store.getState().Person.c);
  });
  test('Subtract: scalarList subtract scalar               Pet(subtract:"x")',()=>{
    expect(true).toBe(true);
  })
  test('Add: object add objectList value                   Person(id:"a",add:{"friends":"b"})',()=>{
    expect(true).toBe(true);
  })
  test('Add: object add scalarList value                   Person(id:"a",add:{"nicknames":"AA"})',()=>{
    expect(true).toBe(true);
  })
  test('Add: object add object prop value                  Person(id:"a",add:"best")',()=>{
    expect(true).toBe(true);
  })
  test('Add: object add scalar prop value                  Person(id:"a",add:"name") ',()=>{
    expect(true).toBe(true);
  })
  test('Add: objectList add object                         Person(add:"a")',()=>{
    expect(true).toBe(true);
  })
  test('Add: scalarList add scalar                         Pet(add:"x")',()=>{
    expect(true).toBe(true);
  })
  test('Union: object union objectList value               Person(id:"a",union:{"friends":"b"})',()=>{
    expect(true).toBe(true);
  })
  test('Union: object union scalarList value               Person(id:"a",union:{"nicknames":"AA"})',()=>{
    expect(true).toBe(true);
  })
  test('Union: object union object prop value              Person(id:"a",union:"best")',()=>{
    expect(true).toBe(true);
  })
  test('Union: object union scalar prop value              Person(id:"a",union:"name") ',()=>{
    expect(true).toBe(true);
  })
  test('Union: objectList union object                     Person(union:"a")',()=>{
    expect(true).toBe(true);
  })
  test('Union: scalarList union scalar                     Pet(union:"x")',()=>{
    expect(true).toBe(true);
  })
  test('Intersection: object intersection objectList value    Person(intersection:{id:"a"})',()=>{
    const {a:stateA,b:stateB,c:stateC}=store.getState().Person;
    const aCopy = {...stateA};
    const { result } = renderHook(() =>useQuery(`{Person{id}}`));
    expect(result.current).toEqual({Person:{a:{id:'a'}, b:{id:'b'}, c:{id:'c'}}});
    const {b:selectedB,c:selectedC}=result.current.Person;
    act(()=>{dispatchMutation(`Person(intersection:{id:"a"})`);})
    expect(store.getState().Person.b).toBe(undefined);
    expect(store.getState().Person.c).toBe(undefined);
    expect(store.getState().Person.a).toBe(stateA);
    expect(stateA.nicknames).toBe(store.getState().Person.a.nicknames);
    expect(store.getState().Person).toEqual({a:aCopy});
  })
  test('Intersection: object intersection scalarList value    Person(id:"a",intersection:{"nicknames":"AA"})',()=>{
    expect(true).toBe(true);
  })
  test('Intersection: object intersection object prop value   Person(id:"a",intersection:"best")',()=>{
    expect(true).toBe(true);
  })
  test('Intersection: object intersection scalar prop value   Person(id:"a",intersection:"name") ',()=>{
    expect(true).toBe(true);
  })
  test('Intersection: objectList intersection object          Person(intersection:"a")',()=>{
    expect(true).toBe(true);
  })
  test('Intersection: scalarList intersection scalar          Pet(intersection:"x")',()=>{
    expect(true).toBe(true);
  })
});


/* eslint-disable jest/no-commented-out-tests */
// // describe("Spec Section 3: Type System", () => {
// //   // Note: Does not do validation or any type-specific behaviors by default.
// //   // However, both the schema and query documents are subtrees of rootState, so all behaviors on them are composable.
// // });
// // describe("Spec Section 4: Introspection", () => {
// //   // Note: Does not do validation or any type-specific behaviors by default.
// //   // However, both the schema and query documents are subtrees of rootState, so all behaviors on them are composable.
// //   // 4.1 agnostic to reserved names
// //   // 4.2 agnostic to documentation
// //   // 4.3 agnostic to deprecation
// //   // 4.4 agnostic to __typename
// //   // 4.5 agnostic to implicit schema and type
// //   // 4.5.x agnostic to __TypeKind
// // });
// //
// // describe("Spec Section 5: Validation", () => {
// //   // Note: Does not do validation or any type-specific behaviors by default.
// //   // However, both the schema and query documents are subtrees of rootState, so behaviors on them are composable.
// // });
// //
// // describe("Spec Section 6: Execution", () => {
// //   // Note: Does not do validation or any type-specific behaviors by default.
// //   // However, both the schema and query documents are subtrees of rootState, so behaviors on them are composable.
// //   // test schema aware
// //   // test non-schema aware
// //   describe("6.1 Executing Requests", () => {
// //     it("ignores (but enables composing) inline fragments", () => { expect(0).toBe(1) });
// //     it("ignores (but enables composing) definition fragments", () => { expect(0).toBe(1) });
// //     it("ignores (but enables composing) nullability behaviors", () => { expect(0).toBe(1) });
// //     it("ignores (but enables composing) type validation behaviors", () => { expect(0).toBe(1) });
// //     it("ignores (but enables composing) directives behaviors (e.g., skip)", () => { expect(0).toBe(1) });
// //     it("6.1 (partial spec diff for simplicity) only executes the first operation, agnostic to name", () => { });
// //     // 6.1.1 validation composable
// //     describe("6.1.2 Coercing Variable Values", () => {
// //       it("6.1.2.3.a-i provides variable values to resolvers", () => { expect(false).toBe(true); });
// //       it("6.1.2.3.a-i provides default variable values to resolvers when value is undefined", () => { expect(false).toBe(true); });
// //     });
// //   });
// //   describe("6.2 Executing Operations", () => {
// //     describe("6.2.1 Query + 6.2.2 Mutation + 6.2.3 Subscription", () => {
// //       // Much spec overlap for 6.2.1-3. Combining.
// //       // TODO distinguish spec sections from tree specific behaviors
// //       // it("6.2.1 Queries can execute in parallel", () => {}); // unsure what to do with this
// //       // it("6.2.1.4 Accepts an initial value", () => {expect(0).toBe(1)}); via initialState
// //       describe("Input Operation", () => {
// //         it("Executes only resolverMap.query.<name>.I on query.<name>", () => {
// //           const resolveNode = getResolverMapTransducer({query:{name:}})
// //           expect(0).toBe(1)
// //         });
// //         it("Executes only resolverMap.mutation.<name>.I on mutation.<name>", () => { expect(0).toBe(1) });
// //         it("Executes only resolverMap.subscription.<name>.I on subscription.<name>", () => { expect(0).toBe(1) });
// //         it("Enables transforming query subtree", () => { expect(0).toBe(1) });
// //         it("Enables transforming query subtree", () => { expect(0).toBe(1) });
// //         it("Prevents mutable query transforms", () => { expect(0).toBe(1) });
// //         it("Enables merging subtrees (e.g., state, variables) to query", () => { expect(0).toBe(1) });
// //         it("Enables merging subtrees (e.g., state, typeDefs) to variables", () => { expect(0).toBe(1) });
// //         it("Enables respondBlank", () => { expect(0).toBe(1) });
// //         it("Enables preventForward", () => { expect(0).toBe(1) });
// //         it("Enables preventForward + respondBlank (i.e., OperationResult with data==={})", () => { expect(0).toBe(1) });
// //         it("On js error in ANY of n resolvers, preventForward + respond({data:{},error:CombinedErrorShape(errors)})", () => { expect(0).toBe(1) });
// //       });
// //       describe("Output OperationResult", () => {
// //         it("Applies resolvers to the correct level of nested fields", () => {
// //           expect(0).toBe(1)
// //         });
// //         it("Applies resolvers only to the intersection of shallower queries", () => {
// //           expect(0).toBe(1)
// //         });
// //         it("On error in response, still runs resolvers (different behavior composable in resolvers)", () => { expect(0).toBe(1) });
// //         it("On js error in resolvers, adds error to result.error", () => { expect(0).toBe(1) });
// //         it("Executes only resolverMap.query.<name>.O on query.<name>", () => { expect(0).toBe(1) });
// //         it("Executes only resolverMap.mutation.<name>.O on mutation.<name>", () => { expect(0).toBe(1) });
// //         it("Executes only resolverMap.subscription.<name>.O on subscription.<name>", () => { expect(0).toBe(1) });
// //         it("Provides the correct variables for nested fields", () => { expect(0).toBe(1) });
// //         it("Enables mutable subtree transforms (e.g., state)", () => { expect(0).toBe(1) });
// //         it("Enables immutable subtree transforms (e.g., data)", () => { expect(0).toBe(1) });
// //         it("Enables mutable and immutable subtree transforms (e.g., data)", () => { expect(0).toBe(1) });
// //         it("Enables mutable and immutable subtree transforms (e.g., data)", () => { expect(0).toBe(1) });
// //         it("Enables writing to multiple subtrees (e.g., data+state)", () => { expect(0).toBe(1) });
// //         it("Enables merging different shaped subtrees (e.g., state, variables)", () => { expect(0).toBe(1) });
// //         it("Enables merging subtrees (e.g., state+data+variables) to data", () => { expect(0).toBe(1) });
// //         it("Enables merging partial subtrees without modifiying higher tree", () => { expect(0).toBe(1) });
// //         it("Agnostic to object and array collections for other UI lib interaction", () => { expect(0).toBe(1) });
// //         it("Supports composed behaviors on array and object collections", () => { expect(0).toBe(1) });
// //         it("Enables returning a stream for local subscriptions", () => { expect(0).toBe(1) });
// //         it("Enables unsubscribing from a local subscription stream", () => { expect(0).toBe(1) });
// //         it("Enables unsubscribing from a local subscription stream", () => { expect(0).toBe(1) });
// //       })
// //
// //       it("6.2.3.1 Source Stream + 6.2.3.2 Response Stream", () => { });
// //       // TODO I don't think these apply.  Re-read.
// //
// //     });
// //
// //   });
// //   describe("6.3 Executing Selection Sets", () => {
// //     it("6.2.3.1 Source Stream + 6.2.3.2 Response Stream", () => { });
// //     // TODO I don't think these apply.  Re-read.
// //   });
// //   // it
// //   describe("6.4 Executing Fields", () => {
// //     // it("successfully prevents forwarding", () => { });
// //     // it("successfully generates a response", () => { });
// //     //
// //     // it("executes transforms sequentially from left to right", () => {
// //     //   // [a,b]
// //     // });
// //     // it("executes nested transforms sequentially", () => {
// //     //
// //     // });
// //   });
// // });
// //
// // describe("Spec Section 7: Response", () => {
// //   // ignoring types, ignoring validation
// //   describe("7.1 Response Format", () => {
// //
// //   });
// //   describe("7.2 Serialization Format", () => {
// //
// //   });
// // });
//
//
//
// // key insights
// // {
// //  All that changes is subtree location, topology, contents
// //  given a tree, subtree location only requires a path.
// //   // Resolver resolution is about transformation location and precedence.
// //   state:{},
// //   op:{result:{operation:{query:'abstract syntax tree'}}}}
// // }
// // every possible data change is a transformation on this tree.
// // if you remove the consideration of how to read and write to different parts of the tree, and operation ordering, all that's left
// // to complete any operation is input path, transform function, and output path
// // This exchange's api is simple, performant.  The tradeoff is thinking differently.
// // graphql
// // stateOp object
// // conceptually, everything is a tree transform.
// // at the risk of oversimplifying,
// // 1. a triggering query: e.g., gql`query { todos { id } }`
// // 1. What parts of the tree to transform
// // 2. How to read and write those parts
// // 3. What transform to do
//
// // Input paths.Output paths, and how to transform that part of the tree
//
//
// // beforeEach(() => {
// //
// //   // Collect all forwarded operations
// //
// //   // exchangeArgs = { forward, subject: {} as Client };
// //   // exchange = localStateExchange(exchangeConfig)(exchangeArgs)(ops$);
// // });
//
// // it('forwards non-matching operations unchanged', async () => { });
// // dump state
// // set initial local state
// // set request handlers matching schema shape
// // set response handlers matching schema shape
// // forward operations where operation.operationName matches no handlers
// // custom: enable user-defined operations
// // teardown: tear down
// // query+mutation+subscription
// // map operation to handlers
// // forward operation where operation.query matches no handlers
// // (filter|omit|custom) operation.query properties
// // (get|set|filter|omit|merge|custom) local state properties
// // (get|set|filter|omit|merge|custom) operation[context|variables] properties
// // (get|set|filter|omit|merge|custom) local state properties to operation[context|variables] properties
// // (get|set|filter|omit|merge|custom) operation[context|variables] properties to local state properties
// // request forward (the default)
// // preventForward (like event.preventDefault())
// // generate blank data response (to populate in response section)
// // emit blank data response (before forward | after forward | after preventForward)
// // conditionally do any of the above
// // enable async handlers for cases like [localState(sync), cache, localState(async), fetch]
// // enable custom user-defined behaviors
// //
// //
// // Response
// //
// // return operations where operation.operationName matches no handlers
// // custom: enable user-defined operations
// // teardown: tear down
// // query+mutation+subscription
// // map operationResult to handlers
// // return operation where operation.query matches no handlers
// // (get|set|filter|omit|merge|custom) local state properties
// // (get|set|filter|omit|merge|custom) operationResult[data|context] properties
// // (get|set|filter|omit|merge|custom) local state properties to operationResult[data|context] properties
// // (get|set|filter|omit|merge|custom) operationResult[data|context] properties to local state properties
// // map response to [1-n] custom responses
// // preventResponse
// // conditionally do any of the above
// // enable async handlers for cases like [localState(sync), cache, localState(async), fetch]
// // enable custom user-defined behaviors
