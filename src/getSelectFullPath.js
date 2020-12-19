import {memoize} from '@a-laughlin/fp-utils';
import {schemaToQuerySelector} from './schemaToQuerySelector';
const getStoreScanner = memoize(store=>{
  let lastState,curState,unsubscribeStore,subscribers;
  return fn=>{
    if(subscribers===undefined){
      subscribers=new Set();
      curState=store.getState();
      unsubscribeStore=store.subscribe(()=>{
        lastState=curState;
        curState=store.getState();
      });
    }
    subscribers.add(fn);
    const result={};
    result.withPrevState=(...args)=>fn(lastState,curState,...args);
    result.cleanup = ()=>{
      subscribers.delete(fn);
      if(subscribers.size===0){
        unsubscribeStore();
        delete result.withPrevState;
        fn=subscribers=lastState=curState=undefined;
      }
    };
    return result;
  };
});

export const getSelectFullPath = (schema,gql,store)=>{
  let selector=schemaToQuerySelector(schema);
  const {withPrevState:selectFullPath,cleanup}=getStoreScanner(store)((lastState,curState,str,variables={},lastResult)=>{
    return (selector(gql(str),variables)(curState,lastState,lastResult));
  });
  return {
    cleanupSelectFullPath:()=>{selector=null;cleanup();},
    selectFullPath
  };
};