import {transToObject,identity,appendArrayReducer, appendObjectReducer, compose, tdMap, isObjectLike, isArray, stubArray, stubObject} from '@a-laughlin/fp-utils';
import indexSchema from './indexSchema';
import {intersection,subtract,union,identity as tdIdentity} from './transducers';

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


const getArgsPopulator = (vars)=>{
  return function getArgs(val){
    const {value,kind,values,fields}=val;
    if (value) return value;
    if (kind==='Variable') return vars[val.name.value];
    if (kind==='NullValue') return null;
    if (values) return values.map(v=>getArgs(v.value))
    if (fields) return transToObject((o,a)=>o[a.name.value]=getArgs(a.value))(fields);
    throw new Error(`getArgs should never reach this`);
  };
}
// td:scalar
// td:[scalar]
// td:{scalarListProp:scalar}                     Person(intersection:{nicknames:"AA"}) | Person(nicknames:"AA")
// td:{scalarListProp:[scalar]}                   Person(intersection:{nicknames:["AA"]})| Person(nicknames:["AA"])
// td:{objectListProp:scalar}                     Person(intersection:{friends:"b"}) | Person(friends:"b")
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

const mapQueryFactory=(schema={},transducers={},getListItemCombiner,getListItemAccumulator)=>(query={},passedVariables={})=>{
  const queryMeta=indexSchema(schema).selectionMeta._query;
  const vars=variableDefinitionsToObject(query.definitions[0].variableDefinitions||[],passedVariables);
  const getArgs = getArgsPopulator(vars);
  const firstSelection=query.definitions[0].selectionSet.selections[0];
  const isMutation=firstSelection.selectionSet===undefined&&firstSelection.arguments.length;
  return inner(queryMeta,query.definitions[0]);
  function inner(meta, s, passedTransducer=identity){
    const onQuery=meta.defName==='_query';
    const sName=onQuery?'_query':s.name.value;
    if(meta.fieldName!==sName) throw new Error(`fieldName ${meta.fieldName} must match s.name.value ${sName} `);
    
    // convert args to transducers
    // Person{intersect:{friends:{id:"a"}}} loop over friends, but apply result to Person
    // Person{friends:{intersect:{id:"a"}}} loop over friends, applying result to friends
    const argTransducers={};
    const composeTransducer=(name,td)=>argTransducers[name]=argTransducers[name]?compose(argTransducers[name],td):td;
    for (const arg of s.arguments??[]){
      const {value:{value,kind,values,fields}={},name:{value:aName}={}}=arg;
      let td = transducers[aName];
      if (aName in argTransducers) throw new Error(`multiple transducers on the same prop not supported yet`);
      if (!td&&!fields)throw new Error(`implicit args not supported yet`);
      if(td){
        if (value) composeTransducer(sName,td(meta,value));
        else if (kind==='NullValue')composeTransducer(sName,td(meta,null));
        else if (kind==='Variable')composeTransducer(sName,td(meta,vars[arg.value.name.value]));
        else if (values) composeTransducer(sName,td(meta,values.map(a=>getArgs(a.value))));
        else if (fields) fields.forEach(a=>{
          let aVal=getArgs(a.value);
          aVal = isObjectLike(aVal)&&!isArray(aVal)?aVal:{[a.name.value]:aVal};
          composeTransducer(sName,td(meta,aVal));
        });
      } else if (fields) fields.forEach(a=>{
        let atd = transducers[a.name.value];
        if (!atd)throw new Error(`implicit args not supported for array yet`);
        composeTransducer(aName,atd(meta[aName],getArgs(a.value)));
      });
      else throw new Error(`shouldn't be hit`);
    }
    // args forest, selections forest, query tree, state tree,
    // different ways to combine them
    // - pass siblingReducer to previous
    // - manually filter on non-transducer props
    // - compose them somehow... difficult since props transducers are recursed, and prev ones mean the need to split/apply/combine the rest of the pipe.
    // 
    const selectionObjs=transToObject((o,a)=>{o[a.name.value]=a})(s.selectionSet?.selections??[]);
    // Walk the query tree beforehand to enclose the correct meta level for each childSelectors
    const selectionMappers=transToObject((o,m,k)=>{
      if(k in selectionObjs) (o[k]=inner(m,selectionObjs[k],argTransducers[k]));
      else if (isMutation) (o[k]=k in argTransducers?inner(m,{name:{value:k}},argTransducers[k]) : ([,vN])=>vN);
    })(meta);
    if (meta.defKind==='object' && !isMutation && s.selectionSet===undefined) return ()=>new Error(`objects must have selections`);
    const mapObject=childMappersToMapObject(selectionMappers);
    if (meta.nodeType==='objectScalar')            return ([,vN])=>vN;
    if (meta.nodeType==='object')                  return mapObject
    if (meta.nodeType==='objectId')                return isMutation
      ? ([vP,vN,vNP,rN,rNP])=>mapObject([vP,vN,vNP,rN,rNP])
      : ([vP,vN,vNP,rN,rNP])=>mapObject([vP,rN[meta.defName][vN],rNP?.[meta.defName]?.[vN],rN,rNP]);
    
    if (meta.nodeType==='objectScalarList')        return tdMapVnorm(compose(
      tdMap((arr,i,vNi)=>vNi),
      argTransducers[sName]??identity,
      passedTransducer,
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    // {Person:{
    //   a:{id:"a",friends:["b","c"]}
    //   b:{id:"a",friends:["a"]}
    // }}
    if (meta.nodeType==='objectObjectList')        return tdMapVnorm(compose(
      tdMap(([vP,vN,vNP,rN,rNP],id,vNi)=>mapObject([vP?.[id],vN?.[id],vNP?.[id],rN,rNP])),
      argTransducers[sName]??identity,
      passedTransducer,
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    // {friends:['a','c']}
    if (meta.nodeType==='objectIdList')            return tdMapVnorm(compose(
      // map key and val
      (isMutation
        ? nextReducer=>(a,[vP,vN,vNP,rN,rNP],i,vNi)=>nextReducer(a,vNi,i,rN[meta.defName][vNi])
        : nextReducer=>(a,[vP,vN,vNP,rN,rNP],i,vNi)=>nextReducer(a, mapObject([vP?.[i],rN[meta.defName][vNi],rNP?.[meta.defName]?.[vNi],rN,rNP],vNi), vNi, rN[meta.defName][vNi])),
      argTransducers[sName]??identity,
      passedTransducer,
    ),getListItemAccumulator(meta),getListItemCombiner(meta));
    throw new Error(`${meta.nodeType}:${meta.defName} shouldn't be hit`);
  }
};


const combineListItemToSame=({nodeType})=>nodeType==='objectScalarList'?appendArrayReducer:appendObjectReducer;
const getSameList= ({nodeType})=>nodeType==='objectScalarList'?stubArray:stubObject;
export const schemaToQuerySelector=(schema,transducers={},listItemCombiner=combineListItemToSame,getListItemAccumulator=getSameList)=>{
  const mapQuery=mapQueryFactory( schema, {...transducers,intersection,subtract,union},listItemCombiner,getListItemAccumulator);
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