import {and, diffBy, isArray,isFinite, isObjectLike, isString, mapToArray, not, tdFilter, tdOmit} from "@a-laughlin/fp-utils"
import { isObject } from 'lodash-es';

const idnty=x=>x;
export const identity=()=>idnty;

// tdFilter(polymorphicListItemTest(meta,args));
export const intersection=(meta,args)=>{
  return nextReducer=>{
    return (accumulator,value,key)=>{
      return polymorphicListItemTest(meta,args)
        ? nextReducer(accumulator,value,key)
        : accumulator;
    }
  }
}

export const subtract=(meta,args)=>tdOmit(polymorphicListItemTest(meta,args));

export const union=(args={},meta)=>nextReducer=>nextReducer;

export const complement=(args={},meta)=>nextReducer=>nextReducer;

const debugPTest=false//meta.nodeType==='objectIdList';
export const polymorphicListItemTest = (meta,args)=>{
  debugPTest && console.log(` meta.nodeType:`,meta.nodeType,` meta.fieldName:`,meta.fieldName,` args:`,args,)
  if(meta.nodeType==='objectScalarList'){
    if(!isObjectLike(args)) return (v,k)=>v===args;
    if(isArray(args)) return (new Set(args)).has;
    throw new Error(`can't compare scalar list values with object argument ${JSON.stringify(args)}`);
  } else if (meta.nodeType==='objectObjectList'){
    if(!isObjectLike(args)) return (obj,k,currentStateObj)=>{
      debugPTest && console.log(`objectObjectList scalar args:`,args,` obj:`,obj,` k:`,k,` currentStateObj:`,currentStateObj,);
      return k===args
    };
    if (isArray(args)) {
      const has=(new Set(args)).has;
      return (obj,k,currentStateObj)=>{
        debugPTest && console.log(`objectObjectList array args:`,args,` obj:`,obj,` k:`,k,` currentStateObj:`,currentStateObj,)
        return has(k);
      };
    }
    return (obj,k,currentStateObj)=>{
      debugPTest && console.log(`objectObjectList object args:`,args,` obj:`,obj,` k:`,k,` currentStateObj:`,currentStateObj,)
      if(currentStateObj===undefined)return false;
      for (const arg in args) if (currentStateObj[arg]!==args[arg]) return false;
      return true;
    }
  } else if (meta.nodeType==='objectIdList') { // never hit..., though working without it.  TBD why.
    if(!isObjectLike(args)) return ((id,k,currentStateObj)=>{
      debugPTest && console.log(`objectIdList scalar args:`,args,` id:`,id,` k:`,k,` currentStateObj:`,currentStateObj,)
      return args===id;
    })
    if (isArray(args)) {
      const has=(new Set(args)).has;
      return (id,k,currentStateObj)=>{
        debugPTest && console.log(`objectIdList array: args:`,args,` id:`,id,` k:`,k,` currentStateObj:`,currentStateObj,)
        return has(id);
      }
    }
    return (id,k,currentStateObj)=>{
      debugPTest && console.log(`objectIdList object: args:`,args,` id:`,id,` k:`,k,` currentStateObj:`,currentStateObj);
      for (const arg in args) if (currentStateObj[arg]!==args[arg]) return false;
      return true;
    }
  }
  throw new Error(`shouldn't be hit since there are only 3 collection types ${JSON.stringify({meta,args,nodeType:meta.nodeType,fieldname:meta.fieldName})}`);
}

export const ADD = nextReducer=>(prevState,action)=>{
  // if collection/item/value
  // which has a simpler dependency graph topology?  These fns, handling different types, or or a mutation tree?
  // note: If mutation tree, these could be property functions, like "filter" and "omit" on query
  return nextReducer(({...prevState,...action.payload}),action)
}
export const SUBTRACT = nextReducer=>(prevState,action)=>{
  const diff = diffBy((v,k)=>k,[prevState,action.payload]);
  let nextState={},k;
  if (diff.aibc===0) return nextReducer(prevState,action); // no intersection to remove
  if (diff.aibc===diff.aubc) return nextReducer(nextState,action); // complete intersection. remove everything
  for (k in diff.anb)nextState[k]=prevState[k]; // copy non-intersecting collection items to new state
  return nextReducer(nextState,action);
}
export const UNION = nextReducer=>(prevState,action)=>{
  const diff = diffBy((v,k)=>k,[prevState,action.payload]);
  let nextState={},k;
  for (k in diff.aub)nextState[k]=action.payload[k]??prevState[k];
  return nextReducer(diff.changedc===0?prevState:nextState,action);
}
export const INTERSECTION = nextReducer=>(prevState,action)=>{
  const diff = diffBy((v,k)=>k,[prevState,action.payload]);
  let nextState={},k;
  for (k in diff.aib)nextState[k]=action.payload[k];
  return nextReducer(diff.changedc===0?prevState:nextState,action);
}
export const SET = nextReducer=>(prevState,action)=>nextReducer(action.payload,action);
export const GET = nextReducer=>(prevState,action)=>nextReducer(prevState,action)
