
export {schemaToReducerMap} from './schemaToReducerMap';
export {pathSelectorToReactHook} from './pathSelectorToReactHook';
export {getSelectFullPath} from './getSelectFullPath';
export {getSelectPath} from './getSelectPath';

import {schemaToDepthFirstOperationMapper} from './schemaToQuerySelector';
import {intersection,subtract,union} from './transducers';
import {appendArrayReducer, appendObjectReducer, stubArray, stubObject} from '@a-laughlin/fp-utils';
export const initGqdux = ({
  gql,
  schema,
  listTransducers={},
  queryListItemCombiner=({nodeType})=>nodeType==='objectScalarList'?appendArrayReducer:appendObjectReducer,
  getQueryListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'?stubArray:stubObject,
  changeListItemCombiner=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?appendArrayReducer:appendObjectReducer,
  getChangeListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?stubArray:stubObject,
}={})=>{
  const getDenormalizedStateMapper = schemaToDepthFirstOperationMapper( schema, {intersection,subtract,union,...listTransducers},queryListItemCombiner,getQueryListItemAccumulator);
  const getNormalizedStateMapper = schemaToDepthFirstOperationMapper( schema, {intersection,subtract,union,...listTransducers},changeListItemCombiner,getChangeListItemAccumulator);
  return {
    // rootReducer (mutation) case
    initReducer:(prevState,{type='mutation',payload:[query={},variables={}]=[]})=>{
      return (type!=='mutation')
        ? prevState
        : getNormalizedStateMapper(query,variables)([
          prevState,
          prevState,
          prevState,
          prevState,// necessary for idList lookups
          prevState,// necessary for idList lookups
        ]);
      },
    // selector (query)
    initSelector:(query,passedVariables)=>(rootNorm={},rootNormPrev={},rootDenormPrev={})=>getDenormalizedStateMapper(query,passedVariables)([
      rootDenormPrev,
      rootNorm,
      rootNormPrev,
      rootNorm, // necessary for idList lookups
      rootNormPrev // necessary for idList lookups
    ])
  }
}