
const { getCellText } = require('./excel-helpers');
const P = require('./patterns');
function level(code) {
  if (P.CODE_322.test(code)) return 1;
  if (P.DIGIT_4.test(code)) return 2;
  if (P.CODE_43.test(code)) return 3;
  if (P.CODE_433.test(code)) return 4;
  if (P.DIGIT_3.test(code)) return 5;
  if (P.SINGLE_ALPHA.test(code)) return 6;
  if (P.DIGIT_6.test(code)) return 7;
  return ({ '>':8, '>>':9, '-':10 })[code] || 99;
}
function tree(rows) {
  const root = {level:0, children:[], rowNum:0, path:''}, stack=[root], nodes=[];
  for (const item of rows) {
    const depth=level(item.code);
    if(depth===99) continue;
    while(stack.length>1 && stack[stack.length-1].level>=depth) stack.pop();
    const parent=stack[stack.length-1];
    const node={...item, level:depth, children:[], parent, path:parent.path+'|'+item.code+(depth>=7?':'+(item.tagging||''): '')};
    parent.children.push(node);nodes.push(node);stack.push(node);
  }
  return {root,nodes};
}
function applySums(ws, columns, start=1) {
  const rows=[];
  for(let r=start;r<=ws.rowCount;r++) {
    const code=getCellText(ws.getRow(r).getCell(1));
    if(level(code)!==99)rows.push({code,rowNum:r});
  }
  for(const node of tree(rows).nodes) {
    if(node.level===10 || !node.children.length)continue;
    for(const col of columns) ws.getRow(node.rowNum).getCell(col).value={formula:'SUM('+node.children.map(c=>col+c.rowNum).join(',')+')'};
  }
}
module.exports={level,tree,applySums};
