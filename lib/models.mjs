// The catalog itself lives in public/models.js so the page and the server read the same product choices.
import {MODELS,choice} from '../public/models.js';
export {EFFORTS,LOCAL_EFFORTS,MODELS,LOCAL,PROVIDERS,choice,setLocalModels,localEntry} from '../public/models.js';
export class SelectionError extends Error {
  constructor() { super('Choose a supported model and effort level.'); this.status=400; this.code='INVALID_SELECTION'; }
}
export function selection({model='astra',effort='medium'}={}) {
  const found=choice(model);
  if (!found || !found.efforts.includes(effort)) throw new SelectionError();
  return {model,effort};
}
export const DEFAULT_ANTHROPIC='fable';
export const FABLE_MODEL=MODELS.find(item=>item.id===DEFAULT_ANTHROPIC).model;
