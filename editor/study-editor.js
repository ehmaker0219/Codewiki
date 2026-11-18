import {Editor, Extension, getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import {Plugin} from '@tiptap/pm/state';
import {isInTable,selectedRect,removeRow,removeColumn} from '@tiptap/pm/tables';
import {MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer} from 'prosemirror-markdown';
import MarkdownIt from 'markdown-it';
import markdownMark from 'markdown-it-mark';
import {FontSize,TextColor,StudyHighlight,ParagraphFormat,fontSizes,textColors,highlightColors,setAlignment,needsRichData,validateFormatting} from './study-formatting.js';

// Notes stay portable Markdown in storage; only the editing surface is rich text.
// No HTML, links, images or embeds enter the document schema.
const deleteNeighbor=(axis,before=false)=>({state,tr,dispatch})=>{
  if(!isInTable(state))return false;
  const rect=selectedRect(state);
  const index=axis==='row'?(before?rect.top-1:rect.bottom):(before?rect.left-1:rect.right);
  const limit=axis==='row'?rect.map.height:rect.map.width;
  if(index<0||index>=limit)return false;
  // Edit the neighboring row/column directly. Mapping preserves the current
  // cell selection, so repeated presses keep using the same reference cell.
  if(dispatch)(axis==='row'?removeRow:removeColumn)(tr,rect,index);
  return true;
};
const studyActions={
  bold:{key:'Mod-b',run:chain=>chain.toggleBold()},
  highlight:{key:'Mod-Alt-h',run:chain=>chain.toggleHighlight()},
  italic:{key:'Mod-i',run:chain=>chain.toggleItalic()},
  underline:{key:'Mod-u',run:chain=>chain.toggleUnderline()},
  strike:{key:'Mod-Shift-x',run:chain=>chain.toggleStrike()},
  heading:{key:'Mod-Alt-2',run:chain=>chain.toggleHeading({level:2})},
  list:{key:'Mod-Shift-8',run:chain=>chain.toggleBulletList()},
  orderedList:{key:'Mod-Shift-7',run:chain=>chain.toggleOrderedList()},
  indent:{key:'Mod-]',run:chain=>chain.sinkListItem('listItem')},
  outdent:{key:'Mod-[',run:chain=>chain.liftListItem('listItem')},
  alignLeft:{key:'Mod-Shift-l',run:chain=>chain.command(setAlignment('left'))},
  alignCenter:{key:'Mod-Shift-e',run:chain=>chain.command(setAlignment('center'))},
  alignRight:{key:'Mod-Shift-r',run:chain=>chain.command(setAlignment('right'))},
  alignJustify:{key:'Mod-Shift-j',run:chain=>chain.command(setAlignment('justify'))},
  clear:{key:'Mod-\\',run:chain=>chain.unsetAllMarks().command(props=>{setAlignment(null)(props);return true;})},
  quote:{key:'Mod-Shift-b',run:chain=>chain.toggleBlockquote()},
  code:{key:'Mod-Alt-k',run:chain=>chain.toggleCodeBlock()},
  table:{key:'Mod-Alt-t',run:chain=>chain.insertTable({rows:3,cols:3,withHeaderRow:true})},
  addRow:{key:'Mod-Alt-r',tableOnly:true,run:chain=>chain.addRowAfter()},
  addRowBefore:{key:'Mod-Alt-u',tableOnly:true,run:chain=>chain.addRowBefore()},
  addColumn:{key:'Mod-Alt-l',tableOnly:true,run:chain=>chain.addColumnAfter()},
  addColumnBefore:{key:'Mod-Alt-j',tableOnly:true,run:chain=>chain.addColumnBefore()},
  deleteRow:{key:'Mod-Alt-Shift-R',tableOnly:true,run:chain=>chain.command(deleteNeighbor('row'))},
  deleteRowBefore:{key:'Mod-Alt-Shift-U',tableOnly:true,run:chain=>chain.command(deleteNeighbor('row',true))},
  deleteColumn:{key:'Mod-Alt-Shift-L',tableOnly:true,run:chain=>chain.command(deleteNeighbor('column'))},
  deleteColumnBefore:{key:'Mod-Alt-Shift-J',tableOnly:true,run:chain=>chain.command(deleteNeighbor('column',true))},
  deleteTable:{key:'Mod-Alt-Shift-T',tableOnly:true,run:chain=>chain.deleteTable()},
  undo:{key:'Mod-z',run:chain=>chain.undo()},
  redo:{key:'Mod-Shift-z',run:chain=>chain.redo()},
};
function runAction(editor,kind,focus=false){
  const action=studyActions[kind];
  if(!editor||!action||(action.tableOnly&&!editor.isActive('table')))return false;
  // Clicks and shortcuts share commands and retain the current text/cell selection.
  return action.run(focus?editor.chain().focus():editor.chain()).run();
}
const studyShortcuts=Extension.create({
  name:'studyShortcuts',priority:1000,
  addKeyboardShortcuts(){return Object.fromEntries(Object.entries(studyActions).map(([kind,{key}])=>[key,()=>runAction(this.editor,kind)]));},
});
const extensions = [StarterKit.configure({link:false,trailingNode:false}), StudyHighlight, FontSize, TextColor, ParagraphFormat, TableKit, studyShortcuts];
const schema = getSchema(extensions);
const tokenizer = new MarkdownIt('commonmark', {html:false, breaks:true})
  .disable(['image','link','autolink']).enable('table').use(markdownMark);
// Markdown cells have inline tokens; the editor requires a paragraph per cell.
tokenizer.core.ruler.after('block','study_table_paragraphs',state=>{
  state.tokens=state.tokens.flatMap(token=>{
    if(token.type==='th_open'||token.type==='td_open')return [token,new state.Token('paragraph_open','p',1)];
    if(token.type==='th_close'||token.type==='td_close')return [new state.Token('paragraph_close','p',-1),token];
    return [token];
  });
});
const parser = new MarkdownParser(schema, tokenizer, {
  blockquote:{block:'blockquote'}, paragraph:{block:'paragraph'},
  list_item:{block:'listItem'}, bullet_list:{block:'bulletList'},
  ordered_list:{block:'orderedList', getAttrs:token=>({start:Number(token.attrGet('start'))||1})},
  heading:{block:'heading',getAttrs:token=>({level:Number(token.tag.slice(1))})},
  code_block:{block:'codeBlock',noCloseToken:true},
  fence:{block:'codeBlock',noCloseToken:true,getAttrs:token=>({language:token.info.trim()||null})},
  hr:{node:'horizontalRule'}, hardbreak:{node:'hardBreak'}, softbreak:{node:'hardBreak'},
  em:{mark:'italic'}, strong:{mark:'bold'}, mark:{mark:'highlight'},
  code_inline:{mark:'code',noCloseToken:true},
  table:{block:'table'},thead:{ignore:true},tbody:{ignore:true},
  tr:{block:'tableRow'},th:{block:'tableHeader'},td:{block:'tableCell'},
});
const defaults = defaultMarkdownSerializer;
const serializer = new MarkdownSerializer({
  blockquote:defaults.nodes.blockquote, paragraph:defaults.nodes.paragraph,
  heading:defaults.nodes.heading, text:defaults.nodes.text,
  bulletList:defaults.nodes.bullet_list, listItem:defaults.nodes.list_item,
  horizontalRule:defaults.nodes.horizontal_rule,
  table(state,node){
    // Use ordinary Markdown tables whenever it can preserve the exact content.
    // Multiline cells, lists or merged cells use a versioned data block instead
    // of silently discarding their structure on save/reload.
    const rows=[];
    node.forEach(row=>{
      const cells=[];
      row.forEach(cell=>cells.push(serializer.serialize(schema.nodes.doc.create(null,cell.content)).replace(/\|/g,'\\|')));
      rows.push('| '+cells.join(' | ')+' |');
    });
    rows.splice(1,0,'| '+Array(node.firstChild.childCount).fill('---').join(' | ')+' |');
    const markdown=rows.join('\n');
    const candidate=parser.parse(markdown);
    if(candidate.childCount===1&&candidate.firstChild.eq(node))state.text(markdown,false);
    else {
      state.write('```codewiki-table-v1\n');
      state.text(JSON.stringify(node.toJSON()),false);
      state.ensureNewLine();state.write('```');
    }
    state.closeBlock(node);
  },
  // Keep hard breaks, including an intentional blank line at the end of a block.
  hardBreak:state=>state.write('\\\n'),
  orderedList(state,node){
    const start=node.attrs.start||1, width=String(start+node.childCount-1).length;
    state.renderList(node,' '.repeat(width+2),i=>String(start+i).padStart(width,' ')+'. ');
  },
  codeBlock(state,node){
    const longest=Math.max(2,...(node.textContent.match(/`+/g)||[]).map(s=>s.length));
    const fence='`'.repeat(longest+1);
    state.write(fence+(node.attrs.language||'')+'\n');state.text(node.textContent,false);
    state.text('\n'+fence,false);state.closeBlock(node);
  },
}, {
  bold:defaults.marks.strong, italic:defaults.marks.em, code:defaults.marks.code,
  highlight:{open:'==',close:'==',mixable:true,expelEnclosingWhitespace:true},
  fontSize:{open:'',close:''}, // Size-bearing blocks use the lossless data format below.
  textColor:{open:'',close:''},underline:{open:'',close:''},strike:{open:'',close:''},
}, {hardBreakNodeName:'hardBreak',escapeExtraCharacters:/=/g});

function parse(body){
  const doc=parser.parse(String(body));
  function restore(node){
    if(node.type==='codeBlock'&&['codewiki-table-v1','codewiki-rich-v1'].includes(node.attrs?.language)){
      try {
        const table=schema.nodeFromJSON(JSON.parse((node.content||[]).map(n=>n.text||'').join('')));
        const allowed=node.attrs.language==='codewiki-table-v1'?['table']:['paragraph','heading','bulletList','orderedList','blockquote','table'];
        if(!allowed.includes(table.type.name))throw new Error('invalid-block');
        table.check();
        validateFormatting(table);
        table.descendants(child=>{
          validateFormatting(child);
          if(child.type.name==='tableCell'||child.type.name==='tableHeader'){
            const {colspan,rowspan,colwidth}=child.attrs;
            if(![colspan,rowspan].every(n=>Number.isInteger(n)&&n>0&&n<=1000)||
              (colwidth!==null&&(!Array.isArray(colwidth)||colwidth.length!==colspan||!colwidth.every(n=>Number.isInteger(n)&&n>=0&&n<=4096))))throw new Error('invalid-cell');
          }
        });
        return table.toJSON();
      }catch {return node;} // Invalid imports remain visible, inert code text.
    }
    return node.content?{...node,content:node.content.map(restore)}:node;
  }
  return schema.nodeFromJSON(restore(doc.toJSON()));
}
// Markdown cannot represent every visual format. Preserve affected top-level blocks
// as schema-validated data, leaving the rest as ordinary portable Markdown.
function encodeRichContent(doc){
  const blocks=[];
  doc.forEach(block=>{
    let sized=needsRichData(block);
    block.descendants(child=>{if(needsRichData(child))sized=true;return !sized;});
    blocks.push(sized?schema.nodes.codeBlock.create({language:'codewiki-rich-v1'},schema.text(JSON.stringify(block.toJSON()))):block);
  });
  return schema.nodes.doc.create(doc.attrs,blocks);
}
// ProseMirror documents are immutable. Reuse conversion for limit checks and
// autosave; WeakMap entries disappear when a document leaves editor history.
const serializedDocs=new WeakMap();
function serialize(doc){
  if(!serializedDocs.has(doc))serializedDocs.set(doc,serializer.serialize(encodeRichContent(doc)));
  return serializedDocs.get(doc);
}
const activeTypes={bold:'bold',italic:'italic',highlight:'highlight',heading:'heading',list:'bulletList',quote:'blockquote',code:'codeBlock'};

function create({element,onChange,onState,onLimit}) {
  let editor=null,textDoc=null,textValue='';
  const sizeLimit=Extension.create({
    name:'studySizeLimit',
    addProseMirrorPlugins(){return [new Plugin({filterTransaction(transaction,state){
      if(!transaction.docChanged)return true;
      const length=serialize(transaction.doc).length;
      if(length<=200000||length<serialize(state.doc).length)return true;
      queueMicrotask(onLimit);return false;
    }})];},
  });
  function setContent(body) {
    // Recreate the view on note switches: undo must never bring back another note.
    editor?.destroy();element.replaceChildren();
    editor=new Editor({
      element,extensions:[...extensions,sizeLimit],content:parse(body).toJSON(),
      injectCSS:false,enableInputRules:false,enablePasteRules:false,
      editorProps:{
        // Leave room for the sticky search bar and the two editing toolbars.
        scrollThreshold:{top:160,bottom:40,left:0,right:0},scrollMargin:{top:180,bottom:60,left:0,right:0},
        attributes:{class:'study-markdown study-rich-input',role:'textbox',
        'aria-label':'노트 본문','aria-multiline':'true',spellcheck:'false',
        'data-placeholder':'배운 내용을 적어 보세요.'}},
      onUpdate:({editor:current})=>onChange(serialize(current.state.doc)),
      onTransaction:()=>onState(),
    });
  }
  function command(kind) {
    return runAction(editor,kind,true);
  }
  return {setContent,command,
    paragraphStyle:()=>editor?.isActive('heading')?'h'+editor.getAttributes('heading').level:editor?.isActive('codeBlock')?'code':'paragraph',
    setParagraphStyle(value){
      if(!editor)return false;
      if(value==='paragraph')return editor.chain().focus().setParagraph().run();
      if(/^h[1-6]$/.test(value))return editor.chain().focus().setHeading({level:Number(value.slice(1))}).run();
      return false;
    },
    color:kind=>editor?.getAttributes(kind).color||'',
    setColor(kind,value){
      if(!editor||editor.isActive('codeBlock')||!['textColor','highlight'].includes(kind))return false;
      const chain=editor.chain().focus();
      if(value==='')return chain.unsetMark(kind).run();
      const palette=kind==='highlight'?highlightColors:textColors;
      return palette.some(([color])=>color===value)&&chain.setMark(kind,{color:value}).run();
    },
    fontSize:()=>editor?.getAttributes('fontSize').size||'',
    setFontSize(value){
      if(!editor||editor.isActive('codeBlock'))return false;
      const chain=editor.chain().focus();
      if(value==='')return chain.unsetMark('fontSize').run();
      const size=Number(value);
      return fontSizes.includes(size)&&chain.setMark('fontSize',{size}).run();
    },
    active:kind=>Boolean(editor&&(kind.startsWith('align')?editor.isActive({textAlign:kind.slice(5).toLowerCase()}):editor.isActive(activeTypes[kind]||kind))),
    can:kind=>Boolean(editor&&studyActions[kind]&&
      (!studyActions[kind].tableOnly||editor.isActive('table'))&&studyActions[kind].run(editor.can().chain()).run()),
    text(){
      const doc=editor?.state.doc;
      if(doc!==textDoc){textDoc=doc;textValue=editor?.getText()||'';}
      return textValue;
    },
    destroy(){editor?.destroy();editor=null;textDoc=null;textValue='';element.replaceChildren();},
  };
}

window.CodeWikiStudyEditor={create,fontSizes,textColors,highlightColors,
  shortcut:(kind,mac=false)=>(studyActions[kind]?.key||'').split('-')
    .map(key=>key==='Mod'?(mac?'⌘':'Ctrl'):key==='Alt'&&mac?'Option':key.length===1?key.toUpperCase():key).join('+'),
  // Pure conversion helpers also exercise the exact bundled parser in tests.
  parse:body=>parse(body).toJSON(),
  serialize:json=>serialize(schema.nodeFromJSON(json)),
};
