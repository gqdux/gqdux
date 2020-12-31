
export {schemaToReducerMap} from './schemaToReducerMap';
export {pathSelectorToReactHook} from './pathSelectorToReactHook';
// export {getSelectPath} from './getSelectPath';

import {schemaToDepthFirstOperationMapper} from './schemaToQuerySelector';
import {intersection,subtract,union} from './transducers';
import {appendArrayReducer, appendObjectReducer, stubArray, stubObject} from '@a-laughlin/fp-utils';
import gql from 'graphql-tag-bundled';
import { getStoreScanner } from './getSelectFullPath';

export const getSelectFullPath = (schema,gql,store)=>{
  let {initSelector}=initGqdux({schema});
  const {withPrevState:selectFullPath,cleanup}=getStoreScanner(store)((lastState,curState,str,variables={},lastResult)=>{
    return (initSelector(gql(str),variables)(curState,lastState,lastResult));
  });
  return {
    cleanupSelectFullPath:()=>{initSelector=null;cleanup();},
    selectFullPath
  };
};

export const initGqdux = ({
  // gql=gql,
  schema,
  listTransducers={},
  queryListItemCombiner=({nodeType})=>nodeType==='objectScalarList'?appendArrayReducer:appendObjectReducer,
  getQueryListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'?stubArray:stubObject,
  changeListItemCombiner=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?appendArrayReducer:appendObjectReducer,
  getChangeListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?stubArray:stubObject,
}={})=>{
  // maps redux state to another normalized redux state.
  // See "should denormalize item subsets with constants" in gqdux.test.js for the difference
  const getNormalizedStateMapper = schemaToDepthFirstOperationMapper( schema, {intersection,subtract,union,...listTransducers},changeListItemCombiner,getChangeListItemAccumulator);
  
  // maps redux state to a denormalized subset of the state for the chosen selections
  const getDenormalizedStateMapper = schemaToDepthFirstOperationMapper( schema, {intersection,subtract,union,...listTransducers},queryListItemCombiner,getQueryListItemAccumulator);
  return {
    // rootReducer (mutation) case
    rootReducer:(prevState, action)=>{
      const {type='mutation',payload:[query={},variables={}]=[]} = action;
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
    initSelector:((query,passedVariables)=>
      (rootNorm={},rootNormPrev={},rootDenormPrev={})=>
        getDenormalizedStateMapper(query,passedVariables)([
          rootDenormPrev,
          rootNorm,
          rootNormPrev,
          rootNorm, // necessary for idList lookups
          rootNormPrev // necessary for idList lookups
        ])),
    initDispatch:store=>(query,vars)=>{
      store.dispatch({type:'mutation',payload:[gql`{${query}}`,vars]});
    }
  }
}