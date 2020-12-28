import {useState,useEffect,createElement} from 'react';
import {styleStringToObj} from '@a-laughlin/style-string-to-object'

export const toHookComposer = (component)=>(...hooks)=>{
  function hookComposer (...props){
    if(!isPlainObject(props[0])) return toHookComposer(component)(...hooks,...props);
    return createElement(component, pipe(...hooks.map(ife(isString,s=>children(s))))(...props));
  }
  hookComposer.isHookComposer=true;
  if (process.env.NODE_ENV !== 'production'){
    // add dev friendly names for debugging
    return Object.defineProperty(hookComposer,'name', {
      value: component.name || (typeof component === 'string' ? component : 'hookComposer'), writable: false
    });
  }
  return hookComposer;
}

export const isHookComposer = fn=>fn.isHookComposer===true;

export const [Div,Span,Ul,Ol,Dt,Dd,Dl,Article,P,H1,H2,H3,H4,H5,H6,Li,Input,A,Label,Pre,Textarea] = (
             'div,span,ul,ol,dt,dd,dl,article,p,h1,h2,h3,h4,h5,h6,li,input,a,label,pre,textarea'
             .split(',').map(toHookComposer));
export const [Button,Img,Header,Svg,G,Path,Polyline,Rect,Line,Circle,Text,Table,Td,Th,Tr] = (
             'button,img,header,svg,g,path,polyline,rect,line,circle,text,table,td,th,tr'
             .split(',').map(toHookComposer));

export const style = cond(
  [isString,str=>style(styleStringToObj(str))],
  [isFunction,fn=>p=>style(fn(p))(p)],
  [isPlainObject,obj=>p=>merge({},p,{style:obj})],
  [stubTrue,arg=>{throw new TypeError('styles only works with objects, strings, or functions that return those');}]
);


export const eventFactory = evtName => (fn=identity)=>p=>
  ({...p,[evtName]:evt=>console.log(`p,evtName`, p,evtName)||fn(p,evt)});

export const [onClick,onChange,onKeydown,onKeyup,onKeyPress,onSubmit,onInput] = (
             'onClick,onChange,onKeydown,onKeyup,onKeyPress,onSubmit,onInput'
             .split(',').map(s=>eventFactory(s)));


export const useObservable = (observable, initialValue) => {
  const [value, setValue] = useState(initialValue);
  useEffect(()=>{
    const subscription = observable.subscribe(setValue);
    return subscription.unsubscribe.bind(subscription);
  }, [observable] );
  return value;
};