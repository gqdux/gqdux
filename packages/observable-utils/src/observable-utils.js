import xstream from 'xstream';
import econcat from 'xstream/extra/concat';
import efromDiagram from 'xstream/extra/fromDiagram';
import efromEvent from 'xstream/extra/fromEvent';
import etween from 'xstream/extra/tween';
import ebuffer from 'xstream/extra/buffer';
import edebounce from 'xstream/extra/debounce';
import edelay from 'xstream/extra/delay';
import edropRepeats from 'xstream/extra/dropRepeats';
import edropUntil from 'xstream/extra/dropUntil';
import eflattenConcurrently from 'xstream/extra/flattenConcurrently';
import eflattenSequentially from 'xstream/extra/flattenSequentially';
import epairwise from 'xstream/extra/pairwise';
import esampleCombine from 'xstream/extra/sampleCombine';
import esplit from 'xstream/extra/split';
import ethrottle from 'xstream/extra/throttle';


// factories
export const xs = xstream;
export const of$ = xs.of.bind(xs);
export const from$ = xs.from.bind(xs);
export const fromArray$ = xs.fromArray.bind(xs);
export const fromPromise$ = xs.fromPromise.bind(xs);
export const create$ = xs.create.bind(xs);
export const never$ = xs.never.bind(xs);
export const empty$ = xs.empty.bind(xs);
export const throw$ = xs.throw.bind(xs);
export const periodic$ = xs.periodic.bind(xs);
export const merge$ = xs.merge.bind(xs);
export const combine$ = xs.combine.bind(xs);
// extras factories
export const concat$ = econcat;
export const fromDiagram$ = efromDiagram;
export const fromEvent$ = efromEvent;
export const tween$ = etween;




// Methods/Operators
// Methods are functions attached to a Stream instance, like stream.addListener().
// Operators are also methods, but return a new Stream, leaving the existing Stream unmodified,
// except for the fact that it has a child Stream attached as Listener. Documentation doesn't say
// which is which
// methods - mutate the existing stream
export const getListener = ({
  next=x=>x,
  error=x=>{throw Error(x);},
  complete=x=>x,
}={})=>({next,error,complete});
export const addListener = (obj)=>s=>{s.addListener(getListener(obj));return s;} // return stream for consistent api
export const getDebugListener = (msg='debug')=>getListener({
  next : console.log.bind(console,msg,'next'),
  error : e =>{console.log(msg,'error');console.error(e);},
  complete : console.log.bind(console,msg,'complete'),
});
export const setDebugListener = msg=>{
  return typeof msg === 'string'
    ? s=>s.setDebugListener(getDebugListener(msg))
    : setDebugListener(getDebugListener('debug'))(msg);
};
export const addDebugListener = msg=>{
  return typeof msg === 'string'
    ? addListener(getDebugListener(msg))
    : addDebugListener('debug')(msg);
};
export const imitate = (...a)=>s=>{s.imitate(...a); return s};

// operators - existing stream unmodified. Receives new stream as a listener.  Return new stream.
export const debug = (...a)=>s=>s.debug(...a);
export const drop = (...a)=>s=>s.drop(...a);
export const endWhen = (...a)=>s=>s.endWhen(...a);
export const filter = (...a)=>s=>s.filter(...a);
export const fold = (...a)=>s=>s.fold(...a); // - returns MemoryStream
export const last = (...a)=>s=>s.last(...a);
export const map = (...a)=>s=>s.map(...a);
export const mapTo = (...a)=>s=>s.mapTo(...a);
export const removeListener = (...a)=>s=>s.removeListener(...a);
export const replaceError = (...a)=>s=>s.replaceError(...a);
export const shamefullySendComplete = (...a)=>s=>s.shamefullySendComplete(...a);
export const shamefullySendError = (...a)=>s=>s.shamefullySendError(...a);
export const shamefullySendNext = (...a)=>s=>s.shamefullySendNext(...a);
export const startWith = (...a)=>s=>s.startWith(...a); // - returns MemoryStream
export const subscribe = obj=>s=>s.subscribe(getListener(obj));
export const take = (...a)=>s=>s.take(...a);
// these make life easier when working with normal pipes
export const mergeWith = (...streams)=>stream=>xs.merge(stream,...streams);
export const combineWith = (...streams)=>stream=>xs.combine(stream,...streams);
// these don't take args
export const remember = s=>s.remember();
export const flatten = s=>s.flatten();


// extras operators
export const buffer = (...args)=>stream=>stream.compose(ebuffer(...args));
export const debounce = (...args)=>stream=>stream.compose(edebounce(...args));
export const delay = (...args)=>stream=>stream.compose(edelay(...args));
export const dropRepeats = stream=>stream.compose(edropRepeats());
export const dropUntil = (...args)=>stream=>stream.compose(edropUntil(...args));
export const flattenConcurrently = stream=>stream.compose(eflattenConcurrently);
export const flattenSequentially = stream=>stream.compose(eflattenSequentially);
export const pairwise = (...args)=>stream=>stream.compose(epairwise(...args));
export const sampleCombine = (...args)=>stream=>stream.compose(esampleCombine(...args));
export const split = (...args)=>stream=>stream.compose(esplit(...args));
export const throttle = (...args)=>stream=>stream.compose(ethrottle(...args));
export const flatMap = fn=>s=>s.map(fn).compose(flattenConcurrently);
export const concatMap = fn=>s=>s.map(fn).compose(flattenSequentially);
export const flatMapLatest = fn=>s=>s.map(fn).flatten();
export const toArray = fn=>s=>s.compose(buffer(never$()));
