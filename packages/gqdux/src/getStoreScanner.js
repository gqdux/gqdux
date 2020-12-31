import {memoize} from '@a-laughlin/fp-utils';

export const getStoreScanner = memoize(store=>{
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
    result.withPrevState=(...args)=>fn(curState,lastState,...args);
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