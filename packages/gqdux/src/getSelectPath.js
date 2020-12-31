import { isObjectLike, mapToObject } from '@a-laughlin/fp-utils';
import { getSelectFullPath } from './gqdux';
// tests exist for this but are commented out until the 
// see useSelectPath in gqdux.test.js
export const getSelectPath=(schema,gql,store)=>{
  const {selectFullPath,cleanupSelectFullPath}=getSelectFullPath(schema,gql,store);
  let lastFullPathResult;
  const selectPath=(queryStr,variables,lastResult)=>{
    const fullPathResult=selectFullPath(queryStr,variables,lastFullPathResult);
    if (lastFullPathResult===fullPathResult) return lastResult;
    lastFullPathResult=fullPathResult;
    let result=fullPathResult;
    const query=gql(queryStr);
    let selections=query.definitions[0].selectionSet.selections;
    while(selections.length===1 && isObjectLike(result)){
      if(selections[0].name.value in result){
        result = result[selections[0].name.value];
      } else {
        let count=0,id;
        result=mapToObject((v,i)=>{
          ++count;
          id=i;
          return v[selections[0].name.value]
        })(result);
        if (count===1) result = result[id];
      }
      selections = selections[0].selectionSet ? selections[0].selectionSet.selections : [];
    }
    return result;
  };
  return {
    cleanupSelectPath:()=>{
      lastFullPathResult=null;
      cleanupSelectFullPath();
    },
    selectPath
  }
};