import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const money=/amount|price|cost|paid|debt|balance|profit|revenue|discount|subtotal|invoiced|refund|expense|receipt|payment|purchase|netAmount|gross|margin|sell\b/i;
const skip=/^(?:count|quantity|units|stock|pages|page|index|id|width|height|weight|date|time)/i;
const method=new Map([[ts.SyntaxKind.PlusToken,'plus'],[ts.SyntaxKind.MinusToken,'minus'],[ts.SyntaxKind.AsteriskToken,'times'],[ts.SyntaxKind.SlashToken,'div']]);
const assigns=new Map([[ts.SyntaxKind.PlusEqualsToken,'plus'],[ts.SyntaxKind.MinusEqualsToken,'minus']]);
const changes=[];
for(const root of ['backend','frontend']){
 const config=ts.readConfigFile(`${root}/tsconfig.json`,ts.sys.readFile);
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.resolve(root));
 const program=ts.createProgram(parsed.fileNames,parsed.options);const checker=program.getTypeChecker();
 for(const sf of program.getSourceFiles()){
  if(!sf.fileName.replaceAll('\\','/').includes(`/${root}/src/`)|| /\.test\.|utils\/financial\.ts|utils\/pagination\.ts|reconcile-invoice-history/.test(sf.fileName.replaceAll('\\','/')))continue;
  const edits=[];
  const text=n=>n.getText(sf);
  const unwrap=n=>ts.isParenthesizedExpression(n)?unwrap(n.expression):n;
  function numeric(n){const t=checker.getTypeAtLocation(n);return !(t.flags & (ts.TypeFlags.StringLike|ts.TypeFlags.BooleanLike)) && !ts.isStringLiteral(n) && !ts.isTemplateExpression(n);}
  function relevant(n){let yes=false;function visit(x){if(ts.isPropertyAccessExpression(x)){if(money.test(x.name.text)&&!skip.test(x.name.text))yes=true;visit(x.expression);return;}if(ts.isIdentifier(x)&&money.test(x.text)&&!skip.test(x.text))yes=true;ts.forEachChild(x,visit);}visit(n);return yes;}
  function expr(n){n=unwrap(n);if(ts.isBinaryExpression(n)&&method.has(n.operatorToken.kind)&&numeric(n)){return `${expr(n.left)}.${method.get(n.operatorToken.kind)}(${expr(n.right)})`;}
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Number'&&n.arguments.length===1)return `decimal(${text(n.arguments[0])})`;
   return `decimal(${text(n)})`;
  }
  function visit(n){
   if(ts.isBinaryExpression(n)&&numeric(n)&&numeric(n.left)&&numeric(n.right)&&(method.has(n.operatorToken.kind)||assigns.has(n.operatorToken.kind))&&relevant(n)){
    const code=assigns.has(n.operatorToken.kind)?`${text(n.left)} = decimal(${text(n.left)}).${assigns.get(n.operatorToken.kind)}(${expr(n.right)}).toNumber()`:`${expr(n)}.toNumber()`;
    edits.push({start:n.getStart(sf),end:n.end,code});changes.push({file:path.relative('.',sf.fileName),line:sf.getLineAndCharacterOfPosition(n.getStart()).line+1,before:text(n),after:code});return;
   }ts.forEachChild(n,visit);
  }visit(sf);
  if(process.argv.includes('--apply')&&edits.length){let s=sf.text;for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.code+s.slice(e.end);
   const financial=path.relative(path.dirname(sf.fileName),path.resolve(root,'src/utils/financial')).replaceAll('\\','/');
   s=`import { decimal } from '${financial.startsWith('.')?financial:'./'+financial}${root==='backend'?'.js':''}';\n`+s;fs.writeFileSync(sf.fileName,s);
  }
 }
}
fs.writeFileSync('.decimal-candidates.json',JSON.stringify(changes,null,2));
console.log(`${changes.length} arithmetic expressions in ${new Set(changes.map(c=>c.file)).size} files`);
