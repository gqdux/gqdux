import {memoize} from '@a-laughlin/fp-utils';
import {initGqdux} from './gqdux';
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
  let {initSelector}=initGqdux({schema});
  const {withPrevState:selectFullPath,cleanup}=getStoreScanner(store)((lastState,curState,str,variables={},lastResult)=>{
    return (initSelector(gql(str),variables)(curState,lastState,lastResult));
  });
  return {
    cleanupSelectFullPath:()=>{initSelector=null;cleanup();},
    selectFullPath
  };
};