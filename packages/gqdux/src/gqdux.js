
import {appendArrayReducer, appendObjectReducer, stubArray, stubObject} from '@a-laughlin/fp-utils';
import gql from 'graphql-tag-bundled';
import {schemaToOperationMapper} from './schemaToOperationMapper';
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
        : getNormalizedStateMapper(query,variables)([
          prevState,
          prevState,
          prevState,
          prevState,// necessary for idList lookups
          prevState,// necessary for idList lookups
        ]);
      },
    // selector to query the store
    getSelector:store=>{
      const storeScanner=getStoreScanner(store);
      const {withPrevState:selector,cleanup}=storeScanner(
        (rootNorm={},rootNormPrev={},query,variables={},rootDenormPrev={})=>{
          query=typeof query==='string'?gql(`{${query}}`):query;
          return getDenormalizedStateMapper(query,variables)([
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
    // dispatch mutations
    getDispatch:store=>(query,variables={})=>{
      store.dispatch({type:'mutation',payload:[gql`{${query}}`,variables]});
    },
    getSelectorHook:(store,useState,useEffect,pathSelector=api.getSelector(store))=>{
      function useQuery (query,variables={}){
        const [denormedState,setState] = useState(pathSelector(query,variables));
        useEffect(()=>store.subscribe(()=> { // returns the unsubscribe function
          setState(prevDenormed=>pathSelector(query,variables,prevDenormed));
        }),[]);
        return denormedState;
      };
      useQuery.cleanup=()=>{pathSelector.cleanup();delete useQuery.cleanup;}
      return useQuery;
    }
  };
  return api;
}