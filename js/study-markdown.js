/* Small, text-only Markdown dialect: never accepts HTML or embeds. */
(() => {
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function inline(text, depth=0) {
    if (depth>5) return escape(text);
    const pattern=/`([^`\n]+)`|\*\*(.+?)\*\*|==(.+?)==|\*([^*\n]+)\*/g;
    let html='', last=0;
    for (const m of text.matchAll(pattern)) {
      html+=escape(text.slice(last,m.index));
      html+=m[1]!==undefined?'<code>'+escape(m[1])+'</code>':m[2]!==undefined?'<strong>'+inline(m[2],depth+1)+'</strong>':m[3]!==undefined?'<mark>'+inline(m[3],depth+1)+'</mark>':'<em>'+inline(m[4],depth+1)+'</em>';
      last=m.index+m[0].length;
    }
    return html+escape(text.slice(last));
  }
  function render(source) {
    const lines=String(source).replace(/\r\n?/g,'\n').split('\n');
    let html='', paragraph=[], list='', code=null;
    const flush=()=>{if(paragraph.length){html+='<p>'+paragraph.map(t=>inline(t)).join('<br>')+'</p>';paragraph=[];}if(list){html+='</'+list+'>';list='';}};
    for (const line of lines) {
      if (/^\s*```/.test(line)) {flush();if(code!==null){html+='<pre><code>'+escape(code.join('\n'))+'</code></pre>';code=null;}else code=[];continue;}
      if(code!==null){code.push(line);continue;}
      if(!line.trim()){flush();continue;}
      const heading=line.match(/^(#{1,3})\s+(.+)$/), item=line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)$/),quote=line.match(/^>\s?(.*)$/);
      if(heading){flush();html+=`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;}
      else if(item){const kind=item[1]?'ul':'ol';if(paragraph.length||list!==kind)flush();if(!list){list=kind;html+='<'+kind+'>';}html+='<li>'+inline(item[2])+'</li>';}
      else if(quote){flush();html+='<blockquote>'+inline(quote[1])+'</blockquote>';}
      else{if(list)flush();paragraph.push(line);}
    }
    flush();if(code!==null)html+='<pre><code>'+escape(code.join('\n'))+'</code></pre>';
    return html;
  }
  function format(text,start,end,kind) {
    if(['heading','quote','list'].includes(kind)) {
      const lineStart=start===0?0:text.lastIndexOf('\n',start-1)+1;
      const prefix=kind==='heading'?'## ':kind==='quote'?'> ':'- ';
      const selected=text.slice(lineStart,end);
      const insert=selected.split('\n').map(line=>prefix+line).join('\n');
      return {text:text.slice(0,lineStart)+insert+text.slice(end),start:lineStart,end:lineStart+insert.length};
    }
    const selection=text.slice(start,end);
    const pairs={bold:['**','**','굵은 글씨'],highlight:['==','==','중요한 내용'],italic:['*','*','기울임'],code:['\n```abap\n','\n```\n','WRITE: / \'Hello\'.']};
    let before,after,content;
    if(pairs[kind]) [before,after,content]=pairs[kind];
    else return {text,start,end};
    const value=selection||content;
    const insert=before+value+after;
    return {text:text.slice(0,start)+insert+text.slice(end),start:start+before.length,end:start+before.length+value.length};
  }
  window.CodeWikiStudyMarkdown={render,format};
})();
