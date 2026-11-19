import {Extension,Mark} from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';

export const fontSizes=[10,11,12,14,16,18,20,24,28,32,36,48];
export const textColors=[['#172b4d','기본 검정'],['#174ea6','파랑'],['#b3261e','빨강'],['#137333','초록'],['#8430a4','보라'],['#b06000','주황'],['#687582','회색']];
export const highlightColors=[['#fff0a6','노랑'],['#c8e6c9','초록'],['#cfe8ff','파랑'],['#f8cddd','분홍'],['#e4d5fa','보라']];
export const alignments=['left','center','right','justify'];
const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const pastedColor=element=>{
  const own=element.getAttribute('data-color');
  if(validColor(own))return own;
  const raw=element.style.backgroundColor;
  if(validColor(raw))return raw;
  const rgb=/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(raw);
  return rgb&&rgb.slice(1).every(n=>Number(n)<=255)?'#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):null;
};
export const StudyHighlight=Highlight.extend({
  addAttributes(){return {color:{default:null,parseHTML:pastedColor,
    renderHTML:attrs=>validColor(attrs.color)?{'data-color':attrs.color,style:`background-color:${attrs.color}`}:{},
  }};},
}).configure({multicolor:true});

export const FontSize=Mark.create({
  name:'fontSize',
  addAttributes(){return {size:{default:14,rendered:false}};},
  parseHTML(){return [{tag:'span[style]',getAttrs:element=>{
    const value=element.style.fontSize,size=Number(value.replace(/px$/,''));
    return value.endsWith('px')&&fontSizes.includes(size)?{size}:false;
  }}];},
  renderHTML({mark}){return ['span',{style:`font-size:${fontSizes.includes(mark.attrs.size)?mark.attrs.size:14}px`},0];},
});

export const TextColor=Mark.create({
  name:'textColor',
  addAttributes(){return {color:{default:'#172b4d',rendered:false}};},
  parseHTML(){return [{tag:'span[data-text-color]',getAttrs:element=>{
    const color=element.getAttribute('data-text-color');return validColor(color)?{color}:false;
  }}];},
  renderHTML({mark}){
    const color=validColor(mark.attrs.color)?mark.attrs.color:'#172b4d';
    return ['span',{'data-text-color':color,style:`color:${color}`},0];
  },
});

// Both paragraphs and headings can occur inside a list item or table cell.
export const setAlignment=value=>({tr,dispatch})=>{
  if(value!==null&&!alignments.includes(value))return false;
  let found=false;
  tr.selection.ranges.forEach(({$from,$to})=>tr.doc.nodesBetween($from.pos,$to.pos,(node,pos)=>{
    if(!['paragraph','heading'].includes(node.type.name))return;
    found=true;
    if(dispatch&&node.attrs.textAlign!==value)tr.setNodeMarkup(pos,undefined,{...node.attrs,textAlign:value});
  }));
  return found;
};
export const ParagraphFormat=Extension.create({
  name:'paragraphFormat',
  addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{textAlign:{
    default:null,
    parseHTML:element=>alignments.includes(element.style.textAlign)?element.style.textAlign:null,
    renderHTML:attrs=>alignments.includes(attrs.textAlign)?{style:`text-align:${attrs.textAlign}`}:{},
  }}}];},
});

export function needsRichData(node){
  // Markdown can trim leading tabs or reinterpret them as indented code.
  // Code blocks already preserve literal whitespace in their fenced form.
  return (node.type.name==='paragraph'&&node.content.size===0)||
    (node.isTextblock&&!node.type.spec.code&&node.textContent.includes('\t'))||Boolean(node.attrs.textAlign)||node.marks.some(mark=>
    ['fontSize','textColor','underline','strike'].includes(mark.type.name)||mark.type.name==='highlight'&&mark.attrs.color);
}
export function validateFormatting(node){
  if(node.attrs.textAlign!=null&&!alignments.includes(node.attrs.textAlign))throw new Error('invalid-alignment');
  for(const mark of node.marks){
    if(mark.type.name==='fontSize'&&!fontSizes.includes(mark.attrs.size))throw new Error('invalid-font-size');
    if(['textColor','highlight'].includes(mark.type.name)&&mark.attrs.color!=null&&!validColor(mark.attrs.color))throw new Error('invalid-color');
  }
}
