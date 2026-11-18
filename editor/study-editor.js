import {Editor, Extension, getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import {Plugin} from '@tiptap/pm/state';
import {MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer} from 'prosemirror-markdown';
import MarkdownIt from 'markdown-it';
import markdownMark from 'markdown-it-mark';

// Notes stay portable Markdown in storage; only the editing surface is rich text.
// No HTML, links, images or embeds enter the document schema.
const extensions = [StarterKit.configure({link:false, underline:false, strike:false, trailingNode:false}), Highlight];
const schema = getSchema(extensions);
const tokenizer = new MarkdownIt('commonmark', {html:false, breaks:true})
  .disable(['image','link','autolink']).use(markdownMark);
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
});
const defaults = defaultMarkdownSerializer;
const serializer = new MarkdownSerializer({
  blockquote:defaults.nodes.blockquote, paragraph:defaults.nodes.paragraph,
  heading:defaults.nodes.heading, text:defaults.nodes.text,
  bulletList:defaults.nodes.bullet_list, listItem:defaults.nodes.list_item,
  horizontalRule:defaults.nodes.horizontal_rule,
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
    state.write('\n'+fence);state.closeBlock(node);
  },
}, {
  bold:defaults.marks.strong, italic:defaults.marks.em, code:defaults.marks.code,
  highlight:{open:'==',close:'==',mixable:true,expelEnclosingWhitespace:true},
}, {hardBreakNodeName:'hardBreak',escapeExtraCharacters:/=/g});

const parse=body=>parser.parse(String(body));
const serialize=doc=>serializer.serialize(doc);
const activeTypes={bold:'bold',italic:'italic',highlight:'highlight',heading:'heading',list:'bulletList',quote:'blockquote',code:'codeBlock'};

function create({element,onChange,onState,onLimit}) {
  let editor=null;
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
      editorProps:{attributes:{class:'study-markdown study-rich-input',role:'textbox',
        'aria-label':'노트 본문','aria-multiline':'true',spellcheck:'false',
        'data-placeholder':'배운 내용을 적어 보세요.'}},
      onUpdate:({editor:current})=>onChange(serialize(current.state.doc)),
      onTransaction:()=>onState(),
      onSelectionUpdate:()=>onState(),
    });
  }
  function command(kind) {
    if(!editor)return;
    const chain=editor.chain().focus();
    const commands={bold:()=>chain.toggleBold(),highlight:()=>chain.toggleHighlight(),
      italic:()=>chain.toggleItalic(),heading:()=>chain.toggleHeading({level:2}),
      list:()=>chain.toggleBulletList(),quote:()=>chain.toggleBlockquote(),
      code:()=>chain.toggleCodeBlock(),undo:()=>chain.undo(),redo:()=>chain.redo()};
    commands[kind]?.().run();
  }
  return {setContent,command,
    active:kind=>Boolean(editor&&editor.isActive(activeTypes[kind]||kind)),
    can:kind=>Boolean(editor&&(kind==='undo'?editor.can().undo():kind==='redo'?editor.can().redo():true)),
    text:()=>editor?.getText()||'',
    destroy(){editor?.destroy();editor=null;element.replaceChildren();},
  };
}

window.CodeWikiStudyEditor={create,
  // Pure conversion helpers also exercise the exact bundled parser in tests.
  parse:body=>parse(body).toJSON(),
  serialize:json=>serialize(schema.nodeFromJSON(json)),
};
