import {keyBy,ensureArray,ensurePropIsObject,memoize, transToObject, setImmutableNonEnumProp, assignEnumAndNonEnumProps} from '@a-laughlin/fp-utils';

export const getDefName=schemaDefinition=>schemaDefinition.name.value;
export const getDefKind=schemaDefinition=>schemaDefinition.kind;
export const getDefFields=schemaDefinition=>schemaDefinition.fields??[];

export const getFieldTypeName=fieldDefinition=>{
  let type=fieldDefinition.type;
  while(type.kind!=='NamedType')type=type.type;
  return type.name.value;
}

export const getFieldMeta=f=>{
  let isList=false,isNonNullList=false,isNonNull=false;
  if(f.type.kind==='NamedType')return{isList,isNonNullList,isNonNull};
  if(f.type.kind==='NonNullType'&&f.type.f.type.kind==='NamedType') return {isList:false,isNonNullList:false,isNonNull:true};
  isList=true;
  isNonNullList=f.type.kind==='NonNullType';
  isNonNull=isNonNullList&&f.type.type.type.kind==='NonNullType';
  return {isList,isNonNull,isNonNullList};
}

export default memoize(schema=>{
  const definitions=ensureArray(schema.definitions).filter(d=>/^(Query|Mutation|Subscription)$/.test(d.name.value)===false);
  const builtInDefinitions=['ID','Int','Float','String','Boolean']
    .map(value=>({kind:'ScalarTypeDefinition',name:{kind:'Name',value}}));
  const allDefs=builtInDefinitions.concat(definitions);
  const definitionsByKind=allDefs.reduce((acc,d)=>{ensurePropIsObject(acc,d.kind)[d.kind][d.name.value]=d;return acc},{});
  const definitionsByName=keyBy(getDefName)(allDefs);
  
  const result = {
    selectionMeta:transToObject((acc,d,cDefName)=>{
      const meta=acc[cDefName]={};
      // define all non-selection props as hidden so iterating over selections works;
      setImmutableNonEnumProp(meta,'defName',cDefName);
      if (cDefName in definitionsByKind.ObjectTypeDefinition){
        setImmutableNonEnumProp(meta,'defKind','object');
        setImmutableNonEnumProp(meta,'objectFields',[]);// enables checking the count of object fields to short-circuit
        for (const f of d.fields){
          const [fieldKeyName,fDefName,{isList,isNonNull,isNonNullList}]=[f.name.value,getFieldTypeName(f),getFieldMeta(f)];
          if (meta.idKey===undefined && fDefName==='ID') setImmutableNonEnumProp(meta,'idKey',fieldKeyName);
          const fMeta = meta[fieldKeyName]={};
          setImmutableNonEnumProp(fMeta,'fieldName',fieldKeyName);
          setImmutableNonEnumProp(fMeta,'fieldKindName',fDefName);
          setImmutableNonEnumProp(fMeta,'isList',isList);
          setImmutableNonEnumProp(fMeta,'isNonNull',isNonNull);
          setImmutableNonEnumProp(fMeta,'isNonNullList',isNonNullList);
          if(fDefName in definitionsByKind.ObjectTypeDefinition){
            meta.objectFields.push(meta[fieldKeyName]);
          }
        }
      } else {
        setImmutableNonEnumProp(meta,'defKind','scalar');
      }
    })(definitionsByName)
  };

  // link defs
  Object.keys(definitionsByKind.ObjectTypeDefinition).forEach(dName=>{
    Object.values(result.selectionMeta[dName]).forEach(fMeta=>{
      assignEnumAndNonEnumProps(fMeta,result.selectionMeta[fMeta.fieldKindName]);
    });
  });
  // create a custom "Query" index of all types, so defining one manually is unnecessary
  // namespaced as _query to prevent conflicts with Query should one be defined
  result.selectionMeta._query = {};
  setImmutableNonEnumProp(result.selectionMeta._query,'defName','_query');
  setImmutableNonEnumProp(result.selectionMeta._query,'defKind','object');
  setImmutableNonEnumProp(result.selectionMeta._query,'nodeType','object');
  // defineHiddenProp(result.selectionMeta._query,'objectFields',[]);
  setImmutableNonEnumProp(result.selectionMeta._query,'fieldName','_query');
  // defineHiddenProp(result.selectionMeta._query,'fieldKindName','_query');
  // defineHiddenProp(result.selectionMeta._query,'idKey','_query');
  const builtins=['ID','Int','Float','String','Boolean'].reduce((o,k)=>(o[k]=true) && o,{});
  Object.entries(result.selectionMeta).forEach(([defName,meta])=>{
    if (defName in builtins||defName==='_query')return;
    const fMeta = result.selectionMeta._query[defName] = {};
    assignEnumAndNonEnumProps(fMeta,meta);
    if(meta.defKind==='object') {
      setImmutableNonEnumProp(fMeta,'isList',true);
      setImmutableNonEnumProp(fMeta,'isNonNull',true);
      setImmutableNonEnumProp(fMeta,'isNonNullList',true);
      setImmutableNonEnumProp(fMeta,'fieldName',defName);
      setImmutableNonEnumProp(fMeta,'fieldKindName','object');
    }
  });
  const getNodeType = ({isList,defKind,defName,fieldName,fieldKindName})=>{
    if (defKind==='scalar') return  (isList ? 'objectScalarList' : 'objectScalar');
    if (isList) return (defName===fieldName ? 'objectObjectList' : 'objectIdList') ;
    return (defName===fieldKindName ? 'objectId' : 'object');
  }
  const ensureNodeType=meta=>meta.nodeType??setImmutableNonEnumProp(meta,'nodeType',getNodeType(meta));
  Object.values(result.selectionMeta).forEach(meta=>{
    ensureNodeType(meta);
    for (const fKey in meta) ensureNodeType(meta[fKey]);
  });


  return result;
});
