
const {number}=require('./rkk-detail-normalizer');
function createEvaluator(ws) {
  const cache=new Map(),active=new Set(),maxRow=ws.rowCount;
  function cell(address) {
    address=address.replace(/\$/g,'').toUpperCase();
    if(!/^[A-Z]+\d+$/.test(address) || Number(address.match(/\d+$/)?.[0])<1 || Number(address.match(/\d+$/)?.[0])>maxRow)throw Error('INVALID_REFERENCE: '+address);
    if(cache.has(address))return cache.get(address);
    if(active.has(address))throw Error('CYCLE: '+address);
    active.add(address);
    try {
      const value=ws.getCell(address).value;
      let result;
      if(value && typeof value==='object' && (value.formula||value.sharedFormula))
        result=parse(ws.getCell(address).formula || value.formula);
      else if(value===null||value===undefined||value==='')result=null;
      else {result=number(value);if(result===null)throw Error('INVALID_VALUE: '+address);}
      cache.set(address,result);return result;
    } finally {active.delete(address);}
  }
  function parse(formula) {
    const tokens=String(formula).replace(/^=/,'').match(/\$?[A-Z]+\$?\d+|[A-Z_]+|\d+(?:\.\d+)?|[()+\-*/,:\s]|./gi).filter(t=>!/\s/.test(t));
    let i=0;
    const expect=t=>{if(tokens[i++]!==t)throw Error('UNSUPPORTED_FORMULA: '+formula);};
    const scalar=x=>Array.isArray(x)?(()=>{throw Error('INVALID_RANGE_OPERAND');})():x??0;
    function primary() {
      const token=tokens[i++];
      if(token==='('){const v=expression();expect(')');return v;}
      if(token==='+'||token==='-'){const v=scalar(primary());return token==='-'?-v:v;}
      if(/^\d/.test(token||''))return Number(token);
      if(/^\$?[A-Z]+\$?\d+$/i.test(token||'')) {
        if(tokens[i]===':') {
          i++;const end=tokens[i++];if(!/^\$?[A-Z]+\$?\d+$/i.test(end||''))throw Error('INVALID_RANGE');
          const a=ws.getCell(token.replace(/\$/g,'')),b=ws.getCell(end.replace(/\$/g,''));
          if((b.row-a.row+1)*(b.col-a.col+1)>100000||b.row<a.row||b.col<a.col)throw Error('INVALID_RANGE');
          const values=[];for(let r=a.row;r<=b.row;r++)for(let c=a.col;c<=b.col;c++)values.push(cell(ws.getRow(r).getCell(c).address));return values;
        }
        return cell(token);
      }
      if(/^[A-Z]+$/i.test(token||'')) {
        const name=token.toUpperCase();expect('(');const args=[];
        if(tokens[i]!==')'){args.push(expression());while(tokens[i]===','){i++;args.push(expression());}}
        expect(')');const vals=args.flat().filter(v=>v!==null);
        if(name==='SUM')return vals.reduce((s,v)=>s+v,0);
        if(name==='PRODUCT')return vals.length?vals.reduce((s,v)=>s*v,1):0;
        if(name==='ROUND'&&args.length===2){const f=10**scalar(args[1]);return Math.round(scalar(args[0])*f)/f;}
        throw Error('UNSUPPORTED_FORMULA: '+name);
      }
      throw Error('UNSUPPORTED_FORMULA: '+formula);
    }
    function product(){let v=primary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=scalar(primary());v=op==='*'?scalar(v)*b:scalar(v)/b;}return v;}
    function expression(){let v=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=scalar(product());v=op==='+'?scalar(v)+b:scalar(v)-b;}return v;}
    const value=expression();if(i!==tokens.length||!Number.isFinite(value))throw Error('UNSUPPORTED_OR_INVALID_FORMULA: '+formula);return value;
  }
  return {cell};
}
module.exports={createEvaluator};
