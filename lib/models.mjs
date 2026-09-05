// These are product choices, never arbitrary model IDs or CLI arguments.
export const EFFORTS = ['low','medium','high','xhigh','max'];
export const MODELS = [
  { id:'astra',label:'Astra',model:'gpt-6-astra',account:'ChatGPT',cli:'Codex',efforts:EFFORTS },
  { id:'fable',label:'Fable 5.1',model:'claude-fable-5-1',account:'Claude',cli:'Claude Code',efforts:EFFORTS }
];
export class SelectionError extends Error {
  constructor() { super('Choose a supported model and effort level.'); this.status=400; this.code='INVALID_SELECTION'; }
}
export function selection({model='astra',effort='medium'}={}) {
  const choice=MODELS.find(item=>item.id===model);
  if (!choice || !choice.efforts.includes(effort)) throw new SelectionError();
  return {model,effort};
}
export const FABLE_MODEL = MODELS[1].model;
