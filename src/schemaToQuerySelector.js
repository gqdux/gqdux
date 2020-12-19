import {transToObject,identity,indexBy, appendArrayReducer, appendObjectReducer, setImmutableNonEnumProp, mapToObject, compose, tdToSame, transToSame, over, mapToArray, tdMap, mapToSame, tdFilter, tdMapWithAcc, tdMapKey, tdTap, isObjectLike, tdLog, isArray, stubArray, stubObject, transArrayToObject, isString, isFunction} from '@a-laughlin/fp-utils';
import indexSchema from './indexSchema';
import {intersection,subtract,union,polymorphicArgTest,identity as tdIdentity} from './transducers';

// td:scalar
// td:[scalar]
// td:{scalarListProp:scalar}                     Person(intersection:{nicknames:"AA"}) | Person(nicknames:"AA")
// td:{scalarListProp:[scalar]}                   Person(intersection:{nicknames:["AA"]})| Person(nicknames:["AA"])
// td:{objectListProp:scalar}                     Person(intersection:{friends:"b"}) | Person(friends:"a")
// td:{objectListProp:[scalar]}                   Person(intersection:{friends:["b"]}) | Person(friends:["a"])
// td:{objectListProp:{scalarKey:scalarVal}}      Person(intersection:{friends:{id:"b"}})
// td:{objectListProp:[{scalarKey:scalarVal}]}    Person(intersection:{friends:[{id:"b"}]})
// returns a function that populates query arguments with passed variables
// scalarListProp:{td:scalar}                     Person(nicknames:{intersection:"AA"}) | Person(nicknames:"AA")
// scalarListProp:{td:[scalar]}                   Person(nicknames:{intersection:["AA"]})| Person(nicknames:["AA"])
// objectListProp:{td:scalar}                     Person(friends:{intersection:"b"}) | Person(friends:"a")
// objectListProp:{td:[scalar]}                   Person(friends:{intersection:["b"]}) | Person(friends:["a"])
// objectListProp:{td:{scalarKey:scalarVal}}      Person(friends:{intersection:{id:"b"}})
// objectListProp:{td:[{scalarKey:scalarVal}]}    Person(friends:{intersection:[{id:"b"}]})
// convert the gql AST definitions to an object for simpler access


const variableDefinitionsToObject = (variableDefinitions=[],passedVariables={})=>
  variableDefinitions.length === 0 ? passedVariables : transToObject((vars,{variable:{name:{value:name}},defaultValue})=>{
    vars[name]=passedVariables[name]??((defaultValue??{}).value);
  })(variableDefinitions);

// iteration sets properties and checks changes.  After iteration choose which parent to return, so unchanged properties result in an unchanged parent.
// loop over lists of items,
const tdMapVnorm = (listItemTransducer,getListItemAccumulator,listItemCombiner)=>arr=>{
  let [vP=getListItemAccumulator(arr),vN={},vNP={}]=arr;
  let v = getListItemAccumulator(arr);
  const comparator = isArray(v)?(v,vP)=>v[v.length]!==vP[v.length]:(v,vP,k)=>v[k]!==vP[k];
  const childReducer=listItemTransducer(listItemCombiner);
  let kk,vv,changed=vN!==vNP;
  
  for ([kk,vv] of Object.entries(vN)) {
    // const result = childReducer({},arr,kk,vv);
    
    v = childReducer(v,arr,kk,vv);
    if(changed===false) changed=comparator(v,vP,kk);
  };
  return changed?v:vP;
}

const childMappersToMapObject = (selectionMappers)=>{
  return function mapObject(arr,k){
    let [vP={},vN={},vNP={},rN,rNP]=arr;
    let v={},ck,changed=vN!==vNP;
    // v check is necessary since an adjacent collection may have changed
    for (ck in selectionMappers) {
      ck in vN && (v[ck]=selectionMappers[ck]([vP[ck],vN[ck],vNP[ck],rN,rNP],ck));
      if(v[ck] !== vP[ck]) changed=true;
    }
    return changed?v:vP;
  };
}


const getArgsPopulator = (transducers,vars)=>{
  const getArgs = (arg,meta)=>{
    const {value:{value,kind,values,fields}}=arg;
    // console.log(` meta:`,meta,)
    const td = transducers[arg.name.value];
    const toLog={name:arg.name.value};
    value&&(toLog.value=value);
    fields&&(toLog.fields=!!fields);
    values&&(toLog.values=!!values);
    kind==='Variable'&&(toLog.var=vars[arg.value.name.value]);

    // if(!td) console.log(toLog);
    
    // console.log(` value:`,!!td,value.fields,value.value)
    if (value) return td?td(meta,value):value;
    if (kind==='NullValue')return td?td(meta,null):null;
    if (kind==='Variable')return td?td(meta,vars[arg.value.name.value]):vars[arg.value.name.value];
    if (values) return td
      ?td(meta,values.map(a=>getArgs(a,meta[a.name?.value]??meta)))// conditionals in case of transducer, or string value
      :values.map(a=>getArgs(a,meta[a.name?.value]??meta));// Person(friends:[{intersect:"b"}]) undefined behavior
    if (fields) return td
      ? td(meta,transToObject((o,a)=>{
        o[a.name.value]=getArgs(a,meta[a.name.value]);
      })(fields))
      : !fields.find(a=>a.name.value in transducers)
        ? transducers.intersection(meta,transToObject((o,a)=>{
          o[a.name.value]=getArgs(a,meta[a.name.value]);
        })(fields))
        : transToObject((o,a)=>{
          o[a.name.value]=getArgs(a,meta[a.name.value])
        })(fields);
    throw new Error(`getArgs should never reach this`);
  };
  return (rootSelection,rootSelectionMeta)=>({
    [rootSelection.name.value]:transToObject((o,a)=>o[a.name.value]=getArgs(a,rootSelectionMeta))(rootSelection.arguments)
  });
}

const mapQueryFactory=(schema={},transducers={},getListItemCombiner,getListItemAccumulator)=>(query={},passedVariables={})=>{
  const queryMeta=indexSchema(schema).selectionMeta._query;
  const rootSelection=query.definitions[0].selectionSet.selections[0];
  const getArgs = getArgsPopulator(transducers,variableDefinitionsToObject(query.definitions[0].variableDefinitions||[],passedVariables));
  const isMutation=rootSelection.selectionSet===undefined;
  return inner(queryMeta,query.definitions[0],getArgs(rootSelection,queryMeta[rootSelection.name.value]));
  function inner( meta, s, args){
    const onQuery=meta.defName==='_query';
    // Walk the query tree beforehand to enclose the correct meta level for each childSelectors
    // if(args!==identity&&!(meta.fieldName in args))throw new Error(`cannot recurse without selections`)
    // if(s===undefined&&args===identity) return undefined;
    // args.name!=='identity'&&console.log({a:'a',args,meta})
    const [transducer,childArgs]=Object.entries(args).reduce((arr,[k,v])=>{
      // console.log(` k:`,k,` v:`,v,);
      if(k in transducers)(arr[0]=arr[0]===identity?v:compose(arr[0],v));
      else (Object.assign(arr[1],v));
      return arr;
    },[identity,{}]);
    // transducer!==identity&&
    console.log(meta.defName,meta.fieldName,s?.name?.value,transducer,childArgs);
    if(!onQuery&&s&&meta.fieldName!==s.name.value) throw new Error(`meta fieldName ${meta.fieldName} must match s.name value ${s.name.value} `);
    // args!== identity && console.log(meta.defName,meta.fieldName,args);
    const onMutationLeaf=isMutation&&!onQuery;
    const selections=s?.selectionSet?.selections||[];
    const selectionMappers = onMutationLeaf
      ? transToObject((o,m,k)=>{
        if(childArgs[k]===undefined) o[k]=(arr)=>arr[1];
        else {
          // console.log(meta.nodeType,meta.defName,m.nodeType,m.defName);
          o[k]=inner(m,undefined,childArgs[k])// passing childPropTransducers applies them
        }
      })(meta)
      : transToObject((o,ss,k)=>{
        o[ss.name.value]=(meta.defName!=='_query'&&meta[ss.name.value].defKind==='object' && ss.selectionSet===undefined)
          ? ()=>new Error(`objects must have selections`)
          : inner(meta[ss.name.value],ss,childArgs?.[ss.name.value]||{});// passing childPropTransducers applies them to selections
      })(selections);

    // don't need to reduce objects since selections reduces them, and no selections effectively selects all
    const mapObject=childMappersToMapObject(selectionMappers,onMutationLeaf&&(meta.nodeType==='objectId'||meta.nodeType==='objectIdList'),meta.nodeType);
    
    if (meta.nodeType==='objectScalar')            return ([,vN])=>vN;
    if (meta.nodeType==='object')                  return mapObject;
    if (meta.nodeType==='objectId')                return ([vP,vN,vNP,rN,rNP],k,vNi)=>{
      isObjectLike(vNi)&&console.log({nodeType:meta.nodeType,vNiObjectLike:isObjectLike(vNi), onMutationLeaf,rNvNidefined:!!rN[meta.defName][vNi],vN});
      return mapObject([vP,rN[meta.defName][vN],rNP?.[meta.defName]?.[vN],rN,rNP],vN,rN[meta.defName][vN]);
    };
    if (meta.nodeType==='objectScalarList')        return tdMapVnorm(compose(
      tdMap((arr,i,vNi)=>vNi),
      transducer,
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    if (meta.nodeType==='objectObjectList')        return tdMapVnorm(compose(
      tdMap(([vP,vN,vNP,rN,rNP],id,vNi)=>mapObject([vP?.[id],vN?.[id],vNP?.[id],rN,rNP])),
      transducer,
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    if (meta.nodeType==='objectIdList')            return tdMapVnorm(compose(
      // map key and val
      nextReducer=>(a,[vP,vN,vNP,rN,rNP],i,vNi)=>{
        // pass main collection to subtract
        // missing from main collection, remove it from this object
        // present in main collection
        // if(!vNi)in 
        if(onMutationLeaf&&vNi==='b'){
          console.log({vNi,i,vN,vNP,defName:meta.defName,onMutationLeaf});
          return nextReducer(
            a,
            vNi,
            i,
            rN[meta.defName][vNi]
          )
        }
        return nextReducer(
          a,
          mapObject([vP?.[i],rN[meta.defName][vNi],rNP?.[meta.defName]?.[vNi],rN,rNP],vNi),
          vNi,
          rN[meta.defName][vNi]
        )
      },
      transducer,
      // nextReducer=>propsTransducer.name==='identity'?nextReducer:(...args)=>{
      //   // console.log(` ...args:`,...args,)
      //   const result = propsTransducer(nextReducer)(...args);
      //   // console.log(` result:`,result,);
      //   return result;
      // },ß
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    throw new Error(`${meta.nodeType}:${meta.defName} shouldn't be hit`);
  }
};


const combineListItemToSame=({nodeType})=>nodeType==='objectScalarList'?appendArrayReducer:appendObjectReducer;
const getSameList= ({nodeType})=>nodeType==='objectScalarList'?stubArray:stubObject;
export const schemaToQuerySelector=(schema,transducers={},listItemCombiner=combineListItemToSame,getListItemAccumulator=getSameList)=>{
  const mapQuery=mapQueryFactory( schema, {...transducers,identity:tdIdentity,intersection,subtract,union},listItemCombiner,getListItemAccumulator);
  return (query,passedVariables)=>{
    const mq = mapQuery(query,passedVariables);
    // if(query?.definitions[0].selectionSet?.selections[0]?.selectionSet){
      return (rootNorm={},rootNormPrev={},rootDenormPrev={})=>mq([rootDenormPrev,rootNorm,rootNormPrev,rootNorm,rootNormPrev]);
    // }
    // return (prevState={},{type='mutation',payload:[query={},variables={}]=[]}={})=>{
    //   if (type!=='mutation')return prevState;
    //   return mq([prevState,prevState,prevState]);
    // }
  }
}
const combineListItemToNormed=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?appendArrayReducer:appendObjectReducer;
const getNormedList= ({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?stubArray:stubObject;
export const schemaToMutationReducer=(schema,transducers={},listItemCombiner=combineListItemToNormed,getListItemAccumulator=getNormedList)=>{
  const mapQuery=mapQueryFactory( schema, {identity:tdIdentity,intersection,union,subtract,...transducers},listItemCombiner,getListItemAccumulator);
  return (prevState={},{type='mutation',payload:[query={},variables={}]=[]}={})=>{
    if (type!=='mutation')return prevState;
    // console.log(query.definitions[0].selectionSet.selections[0].arguments[0].name.value)
    return mapQuery(query,variables)([
      prevState,
      prevState,
      prevState,
      prevState,// necessary for idList lookups
      prevState,// necessary for idList lookups
    ]);
  };
};