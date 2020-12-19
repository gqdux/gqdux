export const pathSelectorToReactHook = (pathSelector,store,useState,useEffect)=>{
  return (query,variables={})=>{
    const [denormedState,setState] = useState(pathSelector(query,variables));
    useEffect(()=>store.subscribe(()=> { // returns the unsubscribe function
      setState(prevDenormed=>pathSelector(query,variables,prevDenormed));
    }),[]);
    return denormedState;
  };
};