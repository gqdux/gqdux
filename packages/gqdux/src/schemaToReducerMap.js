import indexSchema from './indexSchema';
import {ADD,SUBTRACT,UNION,INTERSECTION,SET,GET} from './transducers';
import {transToObject,isString,hasKey,isObjectLike,isInteger,cond,identity,isArray,stubTrue, mapToObject, transArrayToObject,indexBy, pipe} from '@a-laughlin/fp-utils';

// schema aware normalizers, primarily for passing id as string/number;
const schemaToActionNormalizersByDefName = schema=>transToObject((acc,{defKind,idKey,defName})=>{
  if(defName==='_query')return;
  const normalizePayload = cond(
    [()=>defKind!=='object',identity],                             // leave scalars and other non-object types
    [isString,payload=>({[payload]:{[idKey]:payload}})],          // convert number/string id to collection
    [isInteger,payload=>({[payload]:{[idKey]:`${payload}`}})],    // convert number/string id to collection
    [isObjectLike,cond(
      [isArray,transArrayToObject((o,v)=>{                        // convert array to collection
        v=normalizePayload(v);
        o[v[idKey]]=v;
      })],
      [hasKey(idKey), payload=>({[payload[idKey]]:payload})],     // convert single item to collection
      [stubTrue,identity],                                        // collection, leave as is
    )],
    [stubTrue,payload=>new Error(`unrecognized payload type\n${JSON.stringify(payload,null,2)}`)]
  );
  acc[defName] = normalizePayload;
})(indexSchema(schema));


const schemaToOriginalCaseReducerMap = (schema,transducers={ADD,SUBTRACT,UNION,INTERSECTION,SET,GET})=>{
  return transToObject((acc,actionNormalizer,dName)=>{
    for (const OP in transducers){
      const reducer=transducers[OP](identity);
      acc[`${dName}_${OP}`]=(prevState=null,action={})=>reducer(prevState,{...action,payload:actionNormalizer(action.payload)})
    }
  })(schemaToActionNormalizersByDefName(schema));
};

export const schemaToIndividualReducerMap = pipe(
  schemaToOriginalCaseReducerMap,
  transToObject((o,v,k)=>o[k]=k.toUpperCase())
);

export const schemaToReducerMap = pipe(
  schemaToOriginalCaseReducerMap,
  indexBy( (v,k)=>k.split('_')[0], (v,k)=>k.toUpperCase() ),
  mapToObject(v=>(prevState=null,action={})=>action.type in v ? v[action.type](prevState,action) : prevState)
);