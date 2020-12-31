
import {appendArrayReducer, appendObjectReducer, stubArray, stubObject} from '@a-laughlin/fp-utils';
import gql from 'graphql-tag-bundled';
import {schemaToOperationMapper,isQueryMutation} from './schemaToOperationMapper';
import {intersection,subtract,union} from './transducers';
import {getStoreScanner} from './getStoreScanner';

export const initGqdux = ({
  schema,
  listTransducers={},
  getQueryListItemCombiner=({nodeType})=>nodeType==='objectScalarList'?appendArrayReducer:appendObjectReducer,
  getQueryListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'?stubArray:stubObject,
  getChangeListItemCombiner=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?appendArrayReducer:appendObjectReducer,
  getChangeListItemAccumulator=({nodeType})=>nodeType==='objectScalarList'||nodeType==='objectIdList'?stubArray:stubObject,
}={})=>{
  const transducers={intersection,subtract,union,...listTransducers}
  // maps redux state to another normalized redux state.
  // See "should denormalize item subsets with constants" in gqdux.test.js for the difference
  const getNormalizedStateMapper = schemaToOperationMapper( schema, transducers, getChangeListItemCombiner, getChangeListItemAccumulator);
  // maps redux state to a denormalized subset of the state for the chosen selections
  const getDenormalizedStateMapper = schemaToOperationMapper( schema, transducers, getQueryListItemCombiner, getQueryListItemAccumulator);
  
  const api = {
    // rootReducer to process mutations
    rootReducer:(prevState, action)=>{
      const {type='mutation',payload:[query={},variables={}]=[]} = action;
      return (type!=='mutation')
        ? prevState
        : getNormalizedStateMapper(query,variables,true)([
          prevState,
          prevState,
          prevState,
          prevState,// necessary for idList lookups
          prevState,// necessary for idList lookups
        ]);
      },
    // returns single parametric polymorphic fn that infers selection vs dispatch based on query AST shape.
    getGqdux:store=>{
      const storeScanner=getStoreScanner(store);
      const {withPrevState:selector,cleanup}=storeScanner(
        (rootNorm={},rootNormPrev={},query,variables={},rootDenormPrev={})=>{
          query=typeof query==='string'?gql(`{${query}}`):query;
          const {definitions:[{selectionSet:{selections:[{selectionSet:s,arguments:a=[]}]}}]} = query;
          const isMutation = s===undefined&&a.length;
          if(isMutation) {
            store.dispatch({type:'mutation',payload:[query,variables]});
            return;
          }
          return getDenormalizedStateMapper(query,variables,false)([
            rootDenormPrev,
            rootNorm,
            rootNormPrev,
            rootNorm, // necessary for idList lookups
            rootNormPrev // necessary for idList lookups
          ]);
        }
      );
      selector.cleanup=()=>{cleanup();delete selector.cleanup;};
      return selector;
    },
    getSelectorHook:(store,useState,useEffect,selector=api.getGqdux(store))=>{
      function useQuery (query,variables={}){
        const [denormedState,setState] = useState(selector(query,variables));
        useEffect(()=>store.subscribe(()=> { // returns the unsubscribe function
          setState(prevDenormed=>selector(query,variables,prevDenormed));
        }),[]);
        return denormedState;
      };
      useQuery.cleanup=()=>{selector.cleanup();delete useQuery.cleanup;}
      return useQuery;
    }
  };
  return api;
}