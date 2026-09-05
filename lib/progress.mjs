// Extract only a top-level HTML string. Never forward reasoning or raw CLI events.
export function partialHtml(json) {
  let depth=0,key=null,expectKey=false;
  for(let i=0;i<json.length;i++) {
    const c=json[i];
    if(c==='{' || c==='[') {depth++;if(depth===1) expectKey=true;continue;}
    if(c==='}' || c===']') {depth--;continue;}
    if(c===',' && depth===1) {expectKey=true;key=null;continue;}
    if(c!=='"') continue;
    let value='',complete=false;
    for(i++;i<json.length;i++) {
      const ch=json[i];
      if(ch==='"') {complete=true;break;}
      if(ch!=='\\') {value+=ch;continue;}
      const escape=json[++i];
      if(escape===undefined) break;
      if(escape==='u') {
        const hex=json.slice(i+1,i+5);if(!/^[0-9a-f]{4}$/i.test(hex)) break;
        value+=String.fromCharCode(parseInt(hex,16));i+=4;
      } else {
        const chars={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};
        if(!(escape in chars)) return '';
        value+=chars[escape];
      }
    }
    if(depth===1 && !expectKey && key==='html') return value.slice(0,120000);
    if(!complete) return '';
    if(depth===1 && expectKey) {key=value;expectKey=false;}
  }
  return '';
}
export function jsonLines(onEvent) {
  let pending='';
  return chunk=>{
    pending+=chunk;
    if(pending.length>1_000_000) throw new Error('CLI event exceeded the output limit.');
    let end;
    while((end=pending.indexOf('\n'))>=0) {
      const line=pending.slice(0,end);pending=pending.slice(end+1);
      let event;try {event=JSON.parse(line);} catch {continue;}
      onEvent(event);
    }
  };
}
export function htmlProgress(notify=()=>{}) {
  let last='',lastAt=0;
  return (json,force=false)=>{
    const html=partialHtml(json);
    if(html.length<40 || html===last || (!force && Date.now()-lastAt<300)) return;
    last=html;lastAt=Date.now();notify({type:'draft',html});
  };
}
