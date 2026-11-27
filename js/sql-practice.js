/**
 * Interactive ABAP Open SQL Parser, Strict Mode Checker, Evaluator & Workbench UI.
 * Pure client-side implementation (no eval / no network writes); per-user solved state in localStorage.
 */
(() => {
  const esc = v => (window.CodeWikiLearning?.escape
    ? window.CodeWikiLearning.escape(v)
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  const ABAP_KEYWORDS = new Set([
    'SELECT', 'SINGLE', 'DISTINCT', 'FROM', 'AS', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'JOIN', 'ON',
    'INTO', 'CORRESPONDING', 'FIELDS', 'OF', 'TABLE', 'APPENDING', 'UP', 'TO', 'ROWS',
    'WHERE', 'AND', 'OR', 'NOT', 'BETWEEN', 'IN', 'LIKE', 'IS', 'NULL', 'EXISTS',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASCENDING', 'DESCENDING', 'ASC', 'DESC',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COALESCE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'DATA', 'TYPES', 'BEGIN', 'TYPE', 'PARAMETERS', 'DEFAULT', 'FOR', 'ALL', 'ENTRIES', 'SPACE'
  ]);

  function highlightAbap(code) {
    const src = String(code ?? '');
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === '*' && (i === 0 || src[i - 1] === '\n')) {
        let end = src.indexOf('\n', i);
        if (end === -1) end = n;
        out += `<span class="sqlp-tok-cmt">${esc(src.slice(i, end))}</span>`;
        i = end;
        continue;
      }
      if (ch === '"') {
        let end = src.indexOf('\n', i);
        if (end === -1) end = n;
        out += `<span class="sqlp-tok-cmt">${esc(src.slice(i, end))}</span>`;
        i = end;
        continue;
      }
      if (ch === "'") {
        let j = i + 1;
        while (j < n) {
          if (src[j] === "'" && src[j + 1] === "'") { j += 2; continue; }
          if (src[j] === "'") { j++; break; }
          j++;
        }
        out += `<span class="sqlp-tok-str">${esc(src.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (ch === '@') {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_~-]/.test(src[j])) j++;
        const word = src.slice(i + 1, j).toUpperCase();
        if (word === 'DATA') {
          out += `<span class="sqlp-tok-host">@</span><span class="sqlp-tok-kw">DATA</span>`;
        } else {
          out += `<span class="sqlp-tok-host">${esc(src.slice(i, j))}</span>`;
        }
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z0-9_~-]/.test(src[i - 1]))) {
        let j = i + 1;
        while (j < n && /[0-9.]/.test(src[j])) j++;
        if (src[j - 1] === '.') j--;
        out += `<span class="sqlp-tok-num">${esc(src.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_~-]/.test(src[j])) j++;
        const raw = src.slice(i, j);
        const upper = raw.toUpperCase();
        if (ABAP_KEYWORDS.has(upper)) {
          out += `<span class="sqlp-tok-kw">${esc(raw)}</span>`;
        } else {
          out += esc(raw);
        }
        i = j;
        continue;
      }
      out += esc(ch);
      i++;
    }
    return out;
  }

  /* ===================== Tokenizer ===================== */
  function tokenize(source) {
    const tokens = [];
    let i = 0;
    const n = source.length;
    while (i < n) {
      const ch = source[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '*' && (i === 0 || source[i - 1] === '\n')) {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '"') {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (ch === "'") {
        let j = i + 1, val = '';
        let closed = false;
        while (j < n) {
          if (source[j] === "'" && source[j + 1] === "'") { val += "'"; j += 2; continue; }
          if (source[j] === "'") { closed = true; j++; break; }
          val += source[j++];
        }
        if (!closed) throw new SqlError('문자열 리터럴의 닫는 작은따옴표(\')가 빠져 있어요.');
        tokens.push({ type: 'STR', value: val, raw: source.slice(i, j) });
        i = j;
        continue;
      }
      const two = source.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
        tokens.push({ type: 'OP', value: two === '!=' ? '<>' : two });
        i += 2;
        continue;
      }
      if ('=<>+-*/'.includes(ch)) {
        tokens.push({ type: ch === '*' ? 'STAR' : 'OP', value: ch });
        i++;
        continue;
      }
      if (ch === ',' || ch === '(' || ch === ')' || ch === '.') {
        tokens.push({ type: ch, value: ch });
        i++;
        continue;
      }
      if (ch === '@') {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_~-]/.test(source[j])) j++;
        if (j === i + 1) throw new SqlError('`@` 뒤에 변수 이름이나 `DATA(...)`를 입력해 주세요.');
        tokens.push({ type: 'AT_ID', value: source.slice(i + 1, j), upper: source.slice(i + 1, j).toUpperCase() });
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[0-9]/.test(source[j])) j++;
        if (source[j] === '.' && /[0-9]/.test(source[j + 1] || '')) {
          j++;
          while (j < n && /[0-9]/.test(source[j])) j++;
        }
        tokens.push({ type: 'NUM', value: Number(source.slice(i, j)), raw: source.slice(i, j) });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_~-]/.test(source[j])) j++;
        const raw = source.slice(i, j);
        tokens.push({ type: 'ID', value: raw, upper: raw.toUpperCase() });
        i = j;
        continue;
      }
      throw new SqlError(`해석할 수 없는 기호 \`${ch}\`가 포함되어 있어요.`);
    }
    return tokens;
  }

  class SqlError extends Error {
    constructor(message, title = '문법 오류를 확인하세요') {
      super(message);
      this.title = title;
    }
  }

  /* ===================== Recursive-Descent Parser ===================== */
  const CLAUSE_STOPS = new Set(['FROM', 'INTO', 'UP', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'INNER', 'LEFT', 'RIGHT', 'JOIN', 'ON', 'END', 'WHEN', 'THEN', 'ELSE']);
  const AGG_FUNCS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

  function parse(source) {
    const trimmed = String(source ?? '').trim();
    if (!trimmed) throw new SqlError('SELECT 문을 작성한 뒤 채점 버튼을 눌러 주세요.', '입력이 비어 있어요');
    const tokens = tokenize(trimmed);
    if (!tokens.length) throw new SqlError('주석만 있고 실행할 SELECT 문이 없어요.', '입력이 비어 있어요');
    if (tokens[tokens.length - 1].type !== '.') {
      throw new SqlError('ABAP 문장은 마지막에 마침표(`.`)로 끝나야 해요.');
    }
    const body = tokens.slice(0, -1);
    if (body.some(t => t.type === '.')) {
      throw new SqlError('한 번에 하나의 `SELECT` 문장만 작성해 주세요. (문장 중간에 마침표가 있어요.)');
    }

    let pos = 0;
    const peek = (off = 0) => body[pos + off];
    const next = () => body[pos++];
    const isKw = (kw, off = 0) => {
      const t = peek(off);
      return Boolean(t && t.type === 'ID' && t.upper === kw);
    };
    const expectKw = kw => {
      if (!isKw(kw)) throw new SqlError(`\`${kw}\` 키워드가 필요한 위치예요.`);
      return next();
    };

    const meta = {
      commaLists: false,
      spaceLists: false,
      usedAtHostVar: false,
      usedClassicHostVar: false,
      usedNewExpr: false,
      intoBeforeTrailingClauses: false
    };

    function parseSelectStmt(isSubquery) {
      expectKw('SELECT');
      let single = false;
      let distinct = false;
      if (isKw('SINGLE')) { single = true; next(); }
      if (isKw('DISTINCT')) { distinct = true; next(); }

      const items = [];
      let sawComma = false;
      let sawSpaceSep = false;
      while (pos < body.length && !isKw('FROM') && !(isSubquery && peek()?.type === ')')) {
        if (items.length > 0) {
          if (peek()?.type === ',') { sawComma = true; next(); }
          else { sawSpaceSep = true; }
        }
        if (peek()?.type === 'STAR') {
          next();
          items.push({ kind: 'star', alias: null });
        } else if (peek()?.type === 'ID' && peek().value.endsWith('~') && peek(1)?.type === 'STAR') {
          const al = next().value.slice(0, -1).toLowerCase();
          next();
          items.push({ kind: 'star', alias: al });
        } else {
          const expr = parseValueExpr();
          let alias = null;
          if (isKw('AS')) {
            next();
            const alTok = next();
            if (!alTok || alTok.type !== 'ID') throw new SqlError('`AS` 뒤에 유효한 별칭 이름을 입력해 주세요.');
            alias = alTok.value;
          }
          items.push({ kind: 'expr', expr, alias });
        }
      }
      if (!items.length) throw new SqlError('`SELECT` 뒤에 조회할 컬럼이나 `*`를 입력해 주세요.');
      if (sawComma && sawSpaceSep) throw new SqlError('`SELECT` 컬럼 목록에서 쉼표(`,`)를 일부만 사용했어요. 모두 쉼표로 구분하거나 모두 공백으로 구분해 주세요.');
      if (sawComma) meta.commaLists = true;
      if (sawSpaceSep) meta.spaceLists = true;

      expectKw('FROM');
      const fromTableTok = next();
      if (!fromTableTok || fromTableTok.type !== 'ID') throw new SqlError('`FROM` 뒤에 테이블 이름을 입력해 주세요.');
      let fromAlias = fromTableTok.value.toLowerCase();
      if (isKw('AS')) {
        next();
        const aTok = next();
        if (!aTok || aTok.type !== 'ID') throw new SqlError('`FROM` 테이블의 `AS` 뒤에 별칭을 입력해 주세요.');
        fromAlias = aTok.value.toLowerCase();
      }
      const from = { table: fromTableTok.upper, alias: fromAlias };

      const joins = [];
      while (isKw('INNER') || isKw('LEFT') || isKw('JOIN')) {
        let joinType = 'INNER';
        if (isKw('INNER')) { next(); expectKw('JOIN'); joinType = 'INNER'; }
        else if (isKw('LEFT')) {
          next();
          if (isKw('OUTER')) next();
          expectKw('JOIN');
          joinType = 'LEFT';
        } else if (isKw('JOIN')) { next(); joinType = 'INNER'; }

        const jTok = next();
        if (!jTok || jTok.type !== 'ID') throw new SqlError('`JOIN` 뒤에 테이블 이름을 입력해 주세요.');
        let jAlias = jTok.value.toLowerCase();
        if (isKw('AS')) {
          next();
          const aTok = next();
          if (!aTok || aTok.type !== 'ID') throw new SqlError('`JOIN` 테이블의 `AS` 뒤에 별칭을 입력해 주세요.');
          jAlias = aTok.value.toLowerCase();
        }
        expectKw('ON');
        const on = parseBoolExpr();
        joins.push({ type: joinType, table: jTok.upper, alias: jAlias, on });
      }

      let into = null;
      let upTo = null;
      let where = null;
      let groupBy = null;
      let having = null;
      let orderBy = null;
      let sawTrailingClauseAfterInto = false;

      while (pos < body.length && !(isSubquery && peek()?.type === ')')) {
        if (isKw('INTO')) {
          if (into) throw new SqlError('`INTO` 절이 중복으로 작성되었어요.');
          next();
          let corresponding = false;
          let isTable = false;
          if (isKw('CORRESPONDING')) {
            next();
            expectKw('FIELDS');
            expectKw('OF');
            corresponding = true;
          }
          if (isKw('TABLE')) {
            next();
            isTable = true;
          }
          const targetTok = next();
          if (!targetTok) throw new SqlError('`INTO` 뒤에 결과를 담을 변수나 테이블 이름을 입력해 주세요.');
          let hasAt = false;
          let isInline = false;
          let targetName = '';
          if (targetTok.type === 'AT_ID') {
            hasAt = true;
            if (targetTok.upper === 'DATA' && peek()?.type === '(') {
              next();
              const inner = next();
              if (!inner || inner.type !== 'ID') throw new SqlError('`@DATA(...)` 괄호 안에 변수 이름을 입력해 주세요.');
              if (peek()?.type !== ')') throw new SqlError('`@DATA(...)`의 닫는 괄호 `)`가 빠져 있어요.');
              next();
              isInline = true;
              targetName = inner.value;
            } else {
              targetName = targetTok.value;
            }
          } else if (targetTok.type === 'ID') {
            if (targetTok.upper === 'DATA' && peek()?.type === '(') {
              throw new SqlError('인라인 선언은 `DATA(...)` 앞에 `@`를 붙여 `@DATA(...)`로 작성해야 해요.');
            }
            targetName = targetTok.value;
          } else {
            throw new SqlError('`INTO` 대상 변수 이름을 확인해 주세요.');
          }
          into = { targetName, hasAt, isInline, isTable, corresponding };
        } else if (isKw('UP')) {
          next();
          expectKw('TO');
          const numTok = next();
          if (!numTok || numTok.type !== 'NUM' || !Number.isInteger(numTok.value) || numTok.value < 0) {
            throw new SqlError('`UP TO` 뒤에는 0 이상의 정수를 입력해 주세요.');
          }
          expectKw('ROWS');
          upTo = numTok.value;
        } else if (isKw('WHERE')) {
          if (where) throw new SqlError('`WHERE` 절이 중복으로 작성되었어요.');
          if (into) sawTrailingClauseAfterInto = true;
          next();
          where = parseBoolExpr();
        } else if (isKw('GROUP')) {
          if (groupBy) throw new SqlError('`GROUP BY` 절이 중복으로 작성되었어요.');
          if (into) sawTrailingClauseAfterInto = true;
          next();
          expectKw('BY');
          groupBy = parseSimpleExprList('GROUP BY');
        } else if (isKw('HAVING')) {
          if (having) throw new SqlError('`HAVING` 절이 중복으로 작성되었어요.');
          if (into) sawTrailingClauseAfterInto = true;
          next();
          having = parseBoolExpr();
        } else if (isKw('ORDER')) {
          if (orderBy) throw new SqlError('`ORDER BY` 절이 중복으로 작성되었어요.');
          if (into) sawTrailingClauseAfterInto = true;
          next();
          expectKw('BY');
          orderBy = parseOrderList();
        } else {
          const bad = peek();
          throw new SqlError(`예상치 못한 토큰 \`${bad.raw || bad.value}\`이(가) 있어요. 절 순서나 쉼표를 확인해 주세요.`);
        }
      }

      if (!isSubquery && sawTrailingClauseAfterInto) {
        meta.intoBeforeTrailingClauses = true;
      }

      return { single, distinct, items, from, joins, into, upTo, where, groupBy, having, orderBy };
    }

    function parseSimpleExprList(clauseName) {
      const list = [];
      let sawComma = false, sawSpace = false;
      while (pos < body.length) {
        if (peek()?.type === ')') break;
        if (isKw('INTO') || isKw('UP') || isKw('WHERE') || isKw('GROUP') || isKw('HAVING') || isKw('ORDER')) break;
        if (list.length > 0) {
          if (peek()?.type === ',') { sawComma = true; next(); }
          else { sawSpace = true; }
        }
        list.push(parseValueExpr());
      }
      if (!list.length) throw new SqlError(`\`${clauseName}\` 뒤에 컬럼을 입력해 주세요.`);
      if (sawComma && sawSpace) throw new SqlError(`\`${clauseName}\` 컬럼 목록에서 쉼표(,)를 일관되게 사용해 주세요.`);
      if (sawComma) meta.commaLists = true;
      if (sawSpace) meta.spaceLists = true;
      return list;
    }

    function parseOrderList() {
      const list = [];
      let sawComma = false, sawSpace = false;
      while (pos < body.length) {
        if (peek()?.type === ')') break;
        if (isKw('INTO') || isKw('UP') || isKw('WHERE') || isKw('GROUP') || isKw('HAVING')) break;
        if (list.length > 0) {
          if (peek()?.type === ',') { sawComma = true; next(); }
          else { sawSpace = true; }
        }
        const expr = parseValueExpr();
        let dir = 'ASC';
        if (isKw('DESCENDING') || isKw('DESC')) { dir = 'DESC'; next(); }
        else if (isKw('ASCENDING') || isKw('ASC')) { dir = 'ASC'; next(); }
        list.push({ expr, dir });
      }
      if (!list.length) throw new SqlError('`ORDER BY` 뒤에 정렬 기준 컬럼을 입력해 주세요.');
      if (sawComma && sawSpace) throw new SqlError('`ORDER BY` 목록에서 쉼표(,)를 일관되게 사용해 주세요.');
      if (sawComma) meta.commaLists = true;
      if (sawSpace) meta.spaceLists = true;
      return list;
    }

    function parseBoolExpr() { return parseOr(); }

    function parseOr() {
      let left = parseAnd();
      while (isKw('OR')) {
        next();
        left = { type: 'or', left, right: parseAnd() };
      }
      return left;
    }

    function parseAnd() {
      let left = parseNot();
      while (isKw('AND')) {
        next();
        left = { type: 'and', left, right: parseNot() };
      }
      return left;
    }

    function parseNot() {
      if (isKw('NOT')) {
        next();
        return { type: 'not', expr: parseNot() };
      }
      return parsePredicate();
    }

    function parsePredicate() {
      if (isKw('EXISTS')) {
        next();
        if (peek()?.type !== '(') throw new SqlError('`EXISTS` 뒤에 `( SELECT ... )` 서브쿼리가 와야 해요.');
        next();
        const sub = parseSelectStmt(true);
        if (peek()?.type !== ')') throw new SqlError('`EXISTS` 서브쿼리의 닫는 괄호 `)`가 빠져 있어요.');
        next();
        return { type: 'exists', sub };
      }
      if (peek()?.type === '(') {
        const saved = pos;
        next();
        try {
          const inner = parseBoolExpr();
          if (peek()?.type === ')') {
            next();
            return inner;
          }
        } catch {}
        pos = saved;
      }

      const left = parseValueExpr();

      if (isKw('IS')) {
        next();
        let negated = false;
        if (isKw('NOT')) { negated = true; next(); }
        expectKw('NULL');
        return { type: 'isnull', expr: left, negated };
      }

      let negated = false;
      if (isKw('NOT') && (isKw('BETWEEN', 1) || isKw('IN', 1) || isKw('LIKE', 1))) {
        negated = true;
        next();
      }

      if (isKw('BETWEEN')) {
        next();
        const low = parseValueExpr();
        expectKw('AND');
        const high = parseValueExpr();
        return { type: 'between', expr: left, low, high, negated };
      }

      if (isKw('IN')) {
        next();
        if (peek()?.type !== '(') throw new SqlError('`IN` 뒤에 `( 값1, 값2 )` 목록을 입력해 주세요.');
        next();
        const values = [];
        while (pos < body.length && peek()?.type !== ')') {
          if (values.length > 0) {
            if (peek()?.type === ',') next();
          }
          values.push(parseValueExpr());
        }
        if (peek()?.type !== ')') throw new SqlError('`IN ( ... )`의 닫는 괄호 `)`가 빠져 있어요.');
        next();
        if (!values.length) throw new SqlError('`IN ( ... )` 안에 비교할 값을 1개 이상 넣어 주세요.');
        return { type: 'in', expr: left, values, negated };
      }

      if (isKw('LIKE')) {
        next();
        const pattern = parseValueExpr();
        return { type: 'like', expr: left, pattern, negated };
      }

      const opTok = peek();
      const cmpMap = { '=': '=', EQ: '=', '<>': '<>', NE: '<>', '<': '<', LT: '<', '>': '>', GT: '>', '<=': '<=', LE: '<=', '>=': '>=', GE: '>=' };
      const opKey = opTok ? (opTok.type === 'OP' ? opTok.value : opTok.type === 'ID' ? opTok.upper : '') : '';
      if (Object.hasOwn(cmpMap, opKey)) {
        next();
        const right = parseValueExpr();
        return { type: 'cmp', op: cmpMap[opKey], left, right };
      }

      throw new SqlError('비교 조건(`=`, `>=`, `BETWEEN`, `IN`, `LIKE` 등)을 확인해 주세요.');
    }

    function parseValueExpr() { return parseAdd(); }

    function parseAdd() {
      let left = parseMul();
      while (peek()?.type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = next().value;
        meta.usedNewExpr = true;
        left = { type: 'binop', op, left, right: parseMul() };
      }
      return left;
    }

    function parseMul() {
      let left = parsePrimary();
      while ((peek()?.type === 'STAR') || (peek()?.type === 'OP' && peek().value === '/')) {
        const op = next().value;
        meta.usedNewExpr = true;
        left = { type: 'binop', op, left, right: parsePrimary() };
      }
      return left;
    }

    function parsePrimary() {
      const t = peek();
      if (!t) throw new SqlError('표현식이 완성되지 않았어요.');

      if (t.type === 'STR') { next(); return { type: 'lit', value: t.value }; }
      if (t.type === 'NUM') { next(); return { type: 'lit', value: t.value }; }
      if (t.type === 'OP' && t.value === '-') {
        next();
        const inner = parsePrimary();
        if (inner.type === 'lit' && typeof inner.value === 'number') return { type: 'lit', value: -inner.value };
        meta.usedNewExpr = true;
        return { type: 'binop', op: '-', left: { type: 'lit', value: 0 }, right: inner };
      }
      if (t.type === 'AT_ID') {
        next();
        meta.usedAtHostVar = true;
        return { type: 'host', name: t.value.toLowerCase(), raw: '@' + t.value };
      }
      if (t.type === '(') {
        next();
        const expr = parseValueExpr();
        if (peek()?.type !== ')') throw new SqlError('괄호 `)`가 닫히지 않았어요.');
        next();
        return expr;
      }
      if (isKw('CASE')) {
        meta.usedNewExpr = true;
        next();
        const branches = [];
        while (isKw('WHEN')) {
          next();
          const cond = parseBoolExpr();
          expectKw('THEN');
          const val = parseValueExpr();
          branches.push({ cond, val });
        }
        if (!branches.length) throw new SqlError('`CASE` 안에 `WHEN ... THEN ...` 조건을 작성해 주세요.');
        let elseExpr = { type: 'lit', value: null };
        if (isKw('ELSE')) { next(); elseExpr = parseValueExpr(); }
        expectKw('END');
        return { type: 'case', branches, elseExpr };
      }
      if (isKw('COALESCE')) {
        meta.usedNewExpr = true;
        next();
        if (peek()?.type !== '(') throw new SqlError('`COALESCE(` 괄호를 열어 주세요.');
        next();
        const args = [];
        while (pos < body.length && peek()?.type !== ')') {
          if (args.length > 0) {
            if (peek()?.type !== ',') throw new SqlError('`COALESCE` 인수는 쉼표(`,`)로 구분해 주세요.');
            next();
          }
          args.push(parseValueExpr());
        }
        if (peek()?.type !== ')') throw new SqlError('`COALESCE(...)`의 닫는 괄호 `)`가 빠져 있어요.');
        next();
        if (args.length < 2) throw new SqlError('`COALESCE( 값, 기본값 )`에는 인수가 2개 이상 필요해요.');
        return { type: 'coalesce', args };
      }
      if (t.type === 'ID' && AGG_FUNCS.has(t.upper) && peek(1)?.type === '(') {
        const fn = next().upper;
        next();
        if (fn === 'COUNT' && peek()?.type === 'STAR') {
          next();
          if (peek()?.type !== ')') throw new SqlError('`COUNT( * )`의 닫는 괄호 `)`가 빠져 있어요.');
          next();
          return { type: 'agg', fn: 'COUNT', star: true, distinct: false, arg: null };
        }
        let distinct = false;
        if (isKw('DISTINCT')) { distinct = true; next(); }
        const arg = parseValueExpr();
        if (peek()?.type !== ')') throw new SqlError(`\`${fn}( ... )\`의 닫는 괄호 \`)\`가 빠져 있어요.`);
        next();
        return { type: 'agg', fn, star: false, distinct, arg };
      }
      if (t.type === 'ID') {
        if (CLAUSE_STOPS.has(t.upper)) {
          throw new SqlError(`\`${t.value}\` 앞에 필요한 컬럼이나 값이 빠져 있어요.`);
        }
        next();
        const tildeIdx = t.value.indexOf('~');
        if (tildeIdx !== -1) {
          return {
            type: 'col',
            tableAlias: t.value.slice(0, tildeIdx).toLowerCase(),
            col: t.value.slice(tildeIdx + 1).toUpperCase(),
            raw: t.value
          };
        }
        return { type: 'col', tableAlias: null, col: t.upper, raw: t.value };
      }
      throw new SqlError(`표현식에서 \`${t.raw || t.value}\`을(를) 해석할 수 없어요.`);
    }

    const ast = parseSelectStmt(false);
    if (pos < body.length) {
      throw new SqlError(`문장 끝에 해석할 수 없는 부분 \`${body[pos].raw || body[pos].value}\`이(가) 남아 있어요.`);
    }
    ast.meta = meta;
    return ast;
  }

  /* ===================== Evaluator ===================== */
  function hasAggregate(expr) {
    if (!expr) return false;
    if (expr.type === 'agg') return true;
    if (expr.type === 'binop' || expr.type === 'cmp' || expr.type === 'and' || expr.type === 'or') {
      return hasAggregate(expr.left) || hasAggregate(expr.right);
    }
    if (expr.type === 'not' || expr.type === 'isnull') return hasAggregate(expr.expr);
    if (expr.type === 'between') return hasAggregate(expr.expr) || hasAggregate(expr.low) || hasAggregate(expr.high);
    if (expr.type === 'in') return hasAggregate(expr.expr) || expr.values.some(hasAggregate);
    if (expr.type === 'like') return hasAggregate(expr.expr) || hasAggregate(expr.pattern);
    if (expr.type === 'coalesce') return expr.args.some(hasAggregate);
    if (expr.type === 'case') return expr.branches.some(b => hasAggregate(b.cond) || hasAggregate(b.val)) || hasAggregate(expr.elseExpr);
    return false;
  }

  function execute(ast, tables, params = {}, outerRow = null, allowedTables = null) {
    const paramMap = { space: '', ...Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k.toLowerCase(), v])) };
    const usedClassicHosts = { flag: false };

    function loadTable(name) {
      const upper = name.toUpperCase();
      if (!Object.hasOwn(tables, upper)) {
        const hint = allowedTables?.length ? ` 이 문제의 테이블은 ${allowedTables.join(', ')} 예요.` : '';
        throw new SqlError(`테이블 \`${name}\`을(를) 찾을 수 없어요.${hint}`, '테이블 이름 오류');
      }
      return tables[upper];
    }

    const baseTable = loadTable(ast.from.table);
    const aliasMeta = new Map([[ast.from.alias, baseTable]]);
    let rows = baseTable.rows.map(r => ({ [ast.from.alias]: r }));

    for (const join of ast.joins) {
      const jTable = loadTable(join.table);
      aliasMeta.set(join.alias, jTable);
      const nextRows = [];
      for (const leftRow of rows) {
        let matched = false;
        for (const rightRec of jTable.rows) {
          const cand = { ...leftRow, [join.alias]: rightRec };
          if (evalBool(join.on, [cand], aliasMeta)) {
            matched = true;
            nextRows.push(cand);
          }
        }
        if (!matched && join.type === 'LEFT') {
          nextRows.push({ ...leftRow, [join.alias]: null });
        }
      }
      rows = nextRows;
    }

    if (ast.where) {
      rows = rows.filter(r => evalBool(ast.where, [r], aliasMeta));
    }

    const isAggQuery = Boolean(ast.groupBy) ||
      ast.items.some(it => it.kind === 'expr' && hasAggregate(it.expr)) ||
      hasAggregate(ast.having);

    let groups;
    if (ast.groupBy) {
      const map = new Map();
      for (const row of rows) {
        const keyParts = ast.groupBy.map(e => evalScalar(e, [row], aliasMeta));
        const key = JSON.stringify(keyParts);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
      groups = [...map.values()];
    } else if (isAggQuery) {
      groups = [rows];
    } else {
      groups = rows.map(r => [r]);
    }

    if (ast.having) {
      groups = groups.filter(g => evalBool(ast.having, g, aliasMeta));
    }

    // Build projected columns and rows, keeping alias map for ORDER BY.
    const colSpecs = [];
    for (const item of ast.items) {
      if (item.kind === 'star') {
        const aliases = item.alias ? [item.alias] : [...aliasMeta.keys()];
        for (const al of aliases) {
          const tbl = aliasMeta.get(al);
          if (!tbl) throw new SqlError(`알 수 없는 테이블 별칭 \`${al}\`이에요.`);
          for (const col of tbl.columns) {
            colSpecs.push({ name: col.name, type: col.type, evalGroup: g => {
              const rec = g[0]?.[al];
              return rec ? rec[col.name] : null;
            } });
          }
        }
      } else {
        const name = deriveColName(item);
        const type = deriveColType(item.expr, aliasMeta);
        colSpecs.push({ name, type, rawExpr: item.expr, explicitAlias: item.alias, evalGroup: g => evalScalar(item.expr, g, aliasMeta) });
      }
    }

    let entries = groups.map(g => {
      const rawVals = colSpecs.map(spec => spec.evalGroup(g));
      const aliasVals = new Map();
      colSpecs.forEach((spec, idx) => aliasVals.set(spec.name.toUpperCase(), rawVals[idx]));
      return { group: g, rawVals, aliasVals };
    });

    if (ast.orderBy) {
      entries.sort((a, b) => {
        for (const ord of ast.orderBy) {
          const va = evalOrderValue(ord.expr, a, aliasMeta);
          const vb = evalOrderValue(ord.expr, b, aliasMeta);
          const cmp = compareValues(va, vb);
          if (cmp !== 0) return ord.dir === 'DESC' ? -cmp : cmp;
        }
        return 0;
      });
    }

    let projectedRows = entries.map(e =>
      e.rawVals.map((val, idx) => normalizeOutputValue(val, colSpecs[idx].type))
    );

    if (ast.distinct) {
      const seen = new Set();
      projectedRows = projectedRows.filter(r => {
        const k = JSON.stringify(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    if (ast.single) {
      projectedRows = projectedRows.slice(0, 1);
    } else if (ast.upTo !== null) {
      projectedRows = projectedRows.slice(0, ast.upTo);
    }

    return {
      columns: colSpecs.map(c => c.name),
      rows: projectedRows,
      usedClassicHostVar: usedClassicHosts.flag
    };

    function evalOrderValue(expr, entry, aMeta) {
      if (expr.type === 'col' && !expr.tableAlias && entry.aliasVals.has(expr.col)) {
        return entry.aliasVals.get(expr.col);
      }
      return evalScalar(expr, entry.group, aMeta);
    }

    function resolveColumn(expr, row, aMeta) {
      if (!row) return null;
      if (expr.tableAlias) {
        if (aMeta.has(expr.tableAlias)) {
          const tbl = aMeta.get(expr.tableAlias);
          if (!tbl.columns.some(c => c.name === expr.col)) {
            throw new SqlError(`테이블 \`${tbl.name}\`(${expr.tableAlias})에 \`${expr.col}\` 컬럼이 없어요.`, '컬럼 이름 오류');
          }
          const rec = row[expr.tableAlias];
          return rec ? rec[expr.col] : null;
        }
        if (outerRow && Object.hasOwn(outerRow.row, expr.tableAlias)) {
          const tbl = outerRow.aliasMeta.get(expr.tableAlias);
          if (tbl && !tbl.columns.some(c => c.name === expr.col)) {
            throw new SqlError(`테이블 \`${tbl.name}\`(${expr.tableAlias})에 \`${expr.col}\` 컬럼이 없어요.`, '컬럼 이름 오류');
          }
          const rec = outerRow.row[expr.tableAlias];
          return rec ? rec[expr.col] : null;
        }
        throw new SqlError(`알 수 없는 테이블 별칭 \`${expr.tableAlias}\`이에요.`, '별칭 오류');
      }
      const matches = [];
      for (const [al, tbl] of aMeta.entries()) {
        if (tbl.columns.some(c => c.name === expr.col)) matches.push(al);
      }
      if (matches.length === 1) {
        const rec = row[matches[0]];
        return rec ? rec[expr.col] : null;
      }
      if (matches.length > 1) {
        throw new SqlError(`\`${expr.col}\` 컬럼이 여러 테이블에 있어요. \`a~${expr.col.toLowerCase()}\`처럼 별칭을 붙여 구분해 주세요.`, '컬럼 모호성');
      }
      const lower = expr.col.toLowerCase();
      if (Object.hasOwn(paramMap, lower)) {
        usedClassicHosts.flag = true;
        return paramMap[lower];
      }
      if (outerRow) {
        for (const [al, tbl] of outerRow.aliasMeta.entries()) {
          if (tbl.columns.some(c => c.name === expr.col)) {
            const rec = outerRow.row[al];
            return rec ? rec[expr.col] : null;
          }
        }
      }
      throw new SqlError(`컬럼 또는 변수 \`${expr.raw}\`을(를) 찾을 수 없어요.`, '컬럼 이름 오류');
    }

    function evalScalar(expr, group, aMeta) {
      if (!expr) return null;
      switch (expr.type) {
        case 'lit': return expr.value;
        case 'host': {
          if (!Object.hasOwn(paramMap, expr.name)) {
            throw new SqlError(`호스트 변수 \`${expr.raw}\`은(는) 이 문제에 선언되지 않았어요.`, '변수 이름 오류');
          }
          return paramMap[expr.name];
        }
        case 'col': return resolveColumn(expr, group[0], aMeta);
        case 'binop': {
          const l = evalScalar(expr.left, group, aMeta);
          const r = evalScalar(expr.right, group, aMeta);
          if (l === null || r === null) return null;
          const nl = Number(l), nr = Number(r);
          if (expr.op === '+') return nl + nr;
          if (expr.op === '-') return nl - nr;
          if (expr.op === '*') return nl * nr;
          if (expr.op === '/') return nr === 0 ? null : nl / nr;
          return null;
        }
        case 'coalesce': {
          for (const arg of expr.args) {
            const v = evalScalar(arg, group, aMeta);
            if (v !== null && v !== undefined) return v;
          }
          return null;
        }
        case 'case': {
          for (const br of expr.branches) {
            if (evalBool(br.cond, group, aMeta)) return evalScalar(br.val, group, aMeta);
          }
          return evalScalar(expr.elseExpr, group, aMeta);
        }
        case 'agg': {
          if (expr.fn === 'COUNT') {
            if (expr.star) return group.length;
            const vals = group.map(r => evalScalar(expr.arg, [r], aMeta)).filter(v => v !== null && v !== undefined);
            if (expr.distinct) return new Set(vals.map(v => JSON.stringify(v))).size;
            return vals.length;
          }
          const vals = group.map(r => evalScalar(expr.arg, [r], aMeta)).filter(v => v !== null && v !== undefined);
          if (!vals.length) return null;
          if (expr.fn === 'SUM') return vals.reduce((acc, v) => acc + Number(v), 0);
          if (expr.fn === 'AVG') return vals.reduce((acc, v) => acc + Number(v), 0) / vals.length;
          if (expr.fn === 'MIN') return vals.reduce((best, v) => (compareValues(v, best) < 0 ? v : best));
          if (expr.fn === 'MAX') return vals.reduce((best, v) => (compareValues(v, best) > 0 ? v : best));
          return null;
        }
        default: return null;
      }
    }

    function evalBool(expr, group, aMeta) {
      if (!expr) return true;
      switch (expr.type) {
        case 'and': return evalBool(expr.left, group, aMeta) && evalBool(expr.right, group, aMeta);
        case 'or': return evalBool(expr.left, group, aMeta) || evalBool(expr.right, group, aMeta);
        case 'not': return !evalBool(expr.expr, group, aMeta);
        case 'isnull': {
          const v = evalScalar(expr.expr, group, aMeta);
          const isNull = v === null || v === undefined;
          return expr.negated ? !isNull : isNull;
        }
        case 'exists': {
          const subRes = execute(expr.sub, tables, params, { row: group[0], aliasMeta: aMeta }, allowedTables);
          return subRes.rows.length > 0;
        }
        case 'between': {
          const v = evalScalar(expr.expr, group, aMeta);
          const lo = evalScalar(expr.low, group, aMeta);
          const hi = evalScalar(expr.high, group, aMeta);
          if (v === null || lo === null || hi === null) return false;
          const ok = compareValues(v, lo) >= 0 && compareValues(v, hi) <= 0;
          return expr.negated ? !ok : ok;
        }
        case 'in': {
          const v = evalScalar(expr.expr, group, aMeta);
          if (v === null) return false;
          const ok = expr.values.some(item => {
            const iv = evalScalar(item, group, aMeta);
            return iv !== null && compareValues(v, iv) === 0;
          });
          return expr.negated ? !ok : ok;
        }
        case 'like': {
          const v = evalScalar(expr.expr, group, aMeta);
          const p = evalScalar(expr.pattern, group, aMeta);
          if (v === null || p === null) return false;
          const re = likeToRegex(String(p));
          const ok = re.test(String(v));
          return expr.negated ? !ok : ok;
        }
        case 'cmp': {
          const l = evalScalar(expr.left, group, aMeta);
          const r = evalScalar(expr.right, group, aMeta);
          if (l === null || r === null) return false;
          const c = compareValues(l, r);
          if (expr.op === '=') return c === 0;
          if (expr.op === '<>') return c !== 0;
          if (expr.op === '<') return c < 0;
          if (expr.op === '>') return c > 0;
          if (expr.op === '<=') return c <= 0;
          if (expr.op === '>=') return c >= 0;
          return false;
        }
        default: return false;
      }
    }
  }

  function deriveColName(item) {
    if (item.alias) return item.alias.toUpperCase();
    if (item.expr.type === 'col') return item.expr.col;
    if (item.expr.type === 'agg') return item.expr.fn;
    return 'EXPR';
  }

  function deriveColType(expr, aliasMeta) {
    if (!expr) return 'c';
    if (expr.type === 'agg' || expr.type === 'binop') return 'i';
    if (expr.type === 'lit') return typeof expr.value === 'number' ? 'i' : 'c';
    if (expr.type === 'coalesce') return deriveColType(expr.args[expr.args.length - 1], aliasMeta);
    if (expr.type === 'case') return deriveColType(expr.branches[0]?.val, aliasMeta);
    if (expr.type === 'col') {
      const tbls = expr.tableAlias ? [aliasMeta.get(expr.tableAlias)] : [...aliasMeta.values()];
      for (const tbl of tbls) {
        const found = tbl?.columns.find(c => c.name === expr.col);
        if (found) return found.type;
      }
    }
    return 'c';
  }

  function normalizeOutputValue(val, type) {
    if (val === null || val === undefined) return type === 'i' ? 0 : '';
    if (typeof val === 'number') return Number.isInteger(val) ? val : Math.round(val * 100) / 100;
    return String(val);
  }

  function compareValues(a, b) {
    if (a === null && b === null) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const sa = String(a), sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }

  function likeToRegex(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    return new RegExp('^' + escaped + '$');
  }

  /* ===================== Grader & Strict Mode Diagnostics ===================== */
  function getExpectedResult(problem, tables) {
    const refSql = problem.answers.new || problem.answers.classic;
    const refAst = parse(refSql);
    return execute(refAst, tables, problem.params, null, problem.tables);
  }

  function grade(problem, userCode, bank) {
    let ast;
    try {
      ast = parse(userCode);
    } catch (err) {
      return { status: 'error', title: err.title || '문법 오류를 확인하세요', message: err.message };
    }

    if (!ast.into) {
      return {
        status: 'error',
        title: 'INTO 절이 빠져 있어요',
        message: `조회 결과를 담을 \`INTO ${problem.target.kind === 'table' ? 'TABLE ' : ''}${problem.target.inline ? `@DATA(${problem.target.name})` : problem.target.name}\` 절을 작성해 주세요.`
      };
    }

    if (ast.into.targetName.toLowerCase() !== problem.target.name.toLowerCase()) {
      return {
        status: 'error',
        title: 'INTO 대상 변수 이름이 달라요',
        message: `INTO 대상 \`${ast.into.targetName}\`은(는) 선언되지 않았어요. 이 문제의 대상 변수는 \`${problem.target.name}\` 예요.`
      };
    }

    if (ast.single && ast.into.isTable) {
      return {
        status: 'error',
        title: 'SELECT SINGLE과 INTO TABLE은 함께 쓸 수 없어요',
        message: '`SELECT SINGLE`은 단건 조회이므로 `INTO TABLE` 대신 `INTO`로 단일 구조체/변수에 담아야 해요.'
      };
    }
    if (ast.single && ast.orderBy) {
      return {
        status: 'error',
        title: 'SELECT SINGLE에는 ORDER BY를 붙일 수 없어요',
        message: '정렬 기준의 첫 1건이 필요할 때는 `SELECT SINGLE` 대신 `ORDER BY ... UP TO 1 ROWS`를 사용하세요.'
      };
    }
    if (problem.requireSingle && !ast.single) {
      return {
        status: 'error',
        title: 'SELECT SINGLE을 사용해 주세요',
        message: '이 문제는 Primary Key 단건 조회 문제이므로 `SELECT SINGLE`을 사용해야 해요.'
      };
    }
    if (problem.target.kind === 'table' && !ast.into.isTable) {
      return {
        status: 'error',
        title: 'INTO TABLE을 사용해 주세요',
        message: `\`${problem.target.name}\`은(는) Internal Table이므로 \`INTO\` 대신 \`INTO TABLE\`을 사용해야 해요.`
      };
    }
    if (problem.target.kind !== 'table' && ast.into.isTable) {
      return {
        status: 'error',
        title: '단일 변수/구조체에는 INTO TABLE을 쓰지 않아요',
        message: `\`${problem.target.name}\`은(는) Internal Table이 아니므로 \`INTO TABLE\` 대신 \`INTO\`를 사용하세요.`
      };
    }
    if (problem.requireInline && !ast.into.isInline) {
      return {
        status: 'error',
        title: '인라인 선언(@DATA)이 필요해요',
        message: `이 문제는 별도 DATA 선언 없이 \`INTO ${problem.target.kind === 'table' ? 'TABLE ' : ''}@DATA(${problem.target.name})\` 인라인 선언을 사용해야 해요.`
      };
    }
    if (!problem.target.inline && ast.into.isInline) {
      return {
        status: 'error',
        title: '이미 선언된 변수예요',
        message: `\`${problem.target.name}\`은(는) 위에 이미 선언되어 있으므로 \`@DATA(...)\` 대신 \`@${problem.target.name}\`(또는 구문법 \`${problem.target.name}\`)을 사용하세요.`
      };
    }

    let actual;
    try {
      actual = execute(ast, bank.tables, problem.params, null, problem.tables);
    } catch (err) {
      return { status: 'error', title: err.title || '실행 오류를 확인하세요', message: err.message };
    }

    // Strict Mode (Classic vs New) consistency checks
    const hasNewSignals = ast.meta.commaLists || ast.into.hasAt || ast.into.isInline || ast.meta.usedAtHostVar || ast.meta.usedNewExpr;
    const hasClassicSignals = ast.meta.spaceLists || ast.meta.intoBeforeTrailingClauses || !ast.into.hasAt || actual.usedClassicHostVar;

    if (problem.syntax === 'new') {
      if (!ast.into.hasAt) {
        return { status: 'error', title: '신문법(Strict Mode) 규칙 위반', message: '신문법에서는 `INTO` 대상 변수 앞에 반드시 `@`를 붙여야 해요.' };
      }
      if (ast.meta.spaceLists) {
        return { status: 'error', title: '신문법(Strict Mode) 규칙 위반', message: '신문법에서는 `SELECT` / `GROUP BY` / `ORDER BY` 컬럼을 쉼표(`,`)로 구분해야 해요.' };
      }
      if (ast.meta.intoBeforeTrailingClauses) {
        return { status: 'error', title: '신문법(Strict Mode) 규칙 위반', message: '신문법에서는 `INTO` 절을 `WHERE` / `GROUP BY` / `ORDER BY` 뒤(문장 끝)에 배치해야 해요.' };
      }
      if (actual.usedClassicHostVar) {
        return { status: 'error', title: '신문법(Strict Mode) 규칙 위반', message: '신문법에서는 `WHERE` 절의 ABAP 호스트 변수 앞에도 `@`를 붙여야 해요 (예: `@p_carr`).' };
      }
    } else if (hasNewSignals && hasClassicSignals) {
      let detail = '한 문장 안에서 구문법과 신문법 요소가 섞여 있어요.';
      if ((ast.meta.commaLists || ast.meta.usedAtHostVar || ast.meta.usedNewExpr) && !ast.into.hasAt) {
        detail = '쉼표(`,`)나 `@`/표현식 등 신문법 요소를 썼다면 `INTO` 대상 앞에도 `@`를 붙여야 해요.';
      } else if (ast.into.hasAt && ast.meta.spaceLists) {
        detail = '`@`를 사용해 신문법(Strict Mode)이 켜졌으므로 컬럼·정렬 목록도 쉼표(`,`)로 구분해야 해요.';
      } else if (ast.into.hasAt && ast.meta.intoBeforeTrailingClauses) {
        detail = '신문법(Strict Mode)에서는 `INTO` 절을 `WHERE` / `GROUP BY` / `ORDER BY` 뒤(문장 끝)에 두어야 해요.';
      } else if (ast.into.hasAt && actual.usedClassicHostVar) {
        detail = '신문법(Strict Mode)에서는 조건의 모든 ABAP 변수 앞에도 `@`를 붙여야 해요.';
      }
      return { status: 'error', title: '구문법 · 신문법 혼용 오류 (Strict Mode)', message: detail };
    }

    // Inline @DATA(...) requires AS alias on aggregate/expression items.
    if (ast.into.isInline) {
      const missingAlias = ast.items.find(it => it.kind === 'expr' && it.expr.type !== 'col' && !it.alias);
      if (missingAlias) {
        return {
          status: 'error',
          title: '인라인 선언에 AS 별칭이 빠져 있어요',
          message: '`@DATA(...)` 인라인 선언을 쓸 때는 집계 함수나 `CASE`/`COALESCE`/산술 표현식에 반드시 `AS 별칭`을 붙여야 해요.'
        };
      }
    }

    const expected = getExpectedResult(problem, bank.tables);
    const targetFieldNames = (problem.target.fields || expected.columns.map(c => ({ name: c }))).map(f => f.name.toUpperCase());

    // Map actual columns according to INTO [CORRESPONDING FIELDS OF]
    let mappedActualRows = actual.rows;
    let mappedActualCols = actual.columns;
    if (ast.into.corresponding && !ast.into.isInline) {
      const idxMap = targetFieldNames.map(tf => actual.columns.findIndex(c => c.toUpperCase() === tf));
      mappedActualCols = targetFieldNames;
      mappedActualRows = actual.rows.map(r => idxMap.map((idx, fi) => (idx === -1 ? '' : r[idx])));
    }

    if (mappedActualCols.length !== expected.columns.length) {
      return {
        status: 'mismatch',
        title: '실행은 됐지만 열 개수가 달라요',
        message: `기대 결과는 ${expected.columns.length}열(${expected.columns.join(', ')})인데, 작성한 쿼리는 ${mappedActualCols.length}열을 반환했어요.`,
        actual: { columns: mappedActualCols, rows: mappedActualRows }
      };
    }

    if (ast.into.isInline) {
      const aliasDiff = expected.columns.findIndex((c, idx) => c.toUpperCase() !== mappedActualCols[idx].toUpperCase());
      if (aliasDiff !== -1) {
        return {
          status: 'mismatch',
          title: '인라인 테이블 컬럼 이름(AS 별칭)이 달라요',
          message: `${aliasDiff + 1}번째 열의 이름이 기대와 달라요 (기대: \`${expected.columns[aliasDiff]}\`, 작성: \`${mappedActualCols[aliasDiff]}\`). \`AS ${expected.columns[aliasDiff].toLowerCase()}\` 별칭을 확인해 주세요.`,
          actual: { columns: mappedActualCols, rows: mappedActualRows }
        };
      }
    }

    if (mappedActualRows.length !== expected.rows.length) {
      return {
        status: 'mismatch',
        title: '실행은 됐지만 행 개수가 달라요',
        message: `기대 결과는 ${expected.rows.length}행인데, 작성한 쿼리는 ${mappedActualRows.length}행을 반환했어요. \`WHERE\` / \`ON\` / \`HAVING\` 조건이나 \`JOIN\` 종류·\`DISTINCT\`를 확인해 보세요.`,
        actual: { columns: mappedActualCols, rows: mappedActualRows }
      };
    }

    const rowKey = r => JSON.stringify(r);
    const exactMatch = mappedActualRows.every((r, i) => rowKey(r) === rowKey(expected.rows[i]));
    if (!exactMatch) {
      const sortedAct = [...mappedActualRows].map(rowKey).sort();
      const sortedExp = [...expected.rows].map(rowKey).sort();
      const unorderedMatch = sortedAct.every((k, i) => k === sortedExp[i]);

      if (unorderedMatch && !problem.requireOrder) {
        // Unordered match is valid when problem does not require a specific sort order.
      } else if (unorderedMatch && problem.requireOrder) {
        return {
          status: 'mismatch',
          title: '행 내용은 같지만 정렬 순서가 달라요',
          message: '문제에서 요구한 `ORDER BY` 컬럼 순서와 `ASCENDING` / `DESCENDING` 방향을 확인해 주세요.',
          actual: { columns: mappedActualCols, rows: mappedActualRows }
        };
      } else {
        const diffCol = findFirstDiffColumn(mappedActualRows, expected.rows, expected.columns);
        const colMsg = diffCol
          ? `\`${diffCol}\` 열의 값이 기대 결과와 달라요 → SELECT 대상 컬럼, 계산식, 또는 \`WHERE\` / \`ON\` 조건을 확인해 보세요.`
          : '조회된 행의 값이 기대 결과와 달라요. `SELECT` 컬럼 순서와 조건절을 확인해 보세요.';
        return {
          status: 'mismatch',
          title: '실행은 됐지만 결과가 달라요',
          message: colMsg,
          actual: { columns: mappedActualCols, rows: mappedActualRows }
        };
      }
    }

    const usedNew = hasNewSignals && !hasClassicSignals;
    const modeLabel = usedNew ? '신문법(7.40+)' : '구문법(Classic)';
    return {
      status: 'correct',
      title: '정답이에요!',
      message: `${modeLabel}으로 정확하게 작성했어요. (결과 ${expected.rows.length}행이 기대 결과와 완전히 같아요.)`,
      actual: { columns: mappedActualCols, rows: mappedActualRows }
    };
  }

  function findFirstDiffColumn(actRows, expRows, cols) {
    for (let r = 0; r < Math.min(actRows.length, expRows.length); r++) {
      for (let c = 0; c < cols.length; c++) {
        if (String(actRows[r][c]) !== String(expRows[r][c])) return cols[c];
      }
    }
    return null;
  }

  /* ===================== Per-User Progress Storage ===================== */
  let currentUserId = null;
  const activeMounts = new Set();

  function storageKey(uid) {
    return uid ? `codewiki_sql_practice_v1:${uid}` : '';
  }

  function loadSolved(uid) {
    const key = storageKey(uid);
    if (!key) return new Set();
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }

  function saveSolved(uid, solvedSet) {
    const key = storageKey(uid);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...solvedSet]));
    } catch {}
  }

  /* ===================== Inline Markdown Helper ===================== */
  function fmtInline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="sqlp-inline-code">$1</code>');
  }

  const PK_ICON_SVG = '<svg class="sqlp-pk-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>';

  function renderDataTable(columns, rows, opts = {}) {
    return `
      <div class="sqlp-table-wrap">
        <table class="sqlp-table">
          <thead>
            <tr>
              ${columns.map(col => `
                <th scope="col"${col.pk ? ' class="is-pk"' : ''}>
                  <div class="sqlp-col-code">${col.pk ? PK_ICON_SVG : ''}<span>${esc(col.name)}</span></div>
                  ${col.label ? `<div class="sqlp-col-desc">${esc(col.label)}</div>` : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows.map(r => `<tr>${r.map(v => `<td>${v === '' ? '<span class="sqlp-empty-val">∅</span>' : esc(v)}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${Math.max(1, columns.length)}" class="sqlp-no-rows">${esc(opts.emptyText || '조회 결과 0행')}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ===================== Workbench UI Mount ===================== */
  function mount(slot) {
    const bank = window.CodeWikiSqlPracticeBank;
    if (!slot || !bank || !Array.isArray(bank.problems) || !bank.problems.length) return null;

    let userId = currentUserId || window.CodeWikiAuth?.getCurrentUser?.()?.id || null;
    let solved = loadSolved(userId);
    let activeCategory = 'all';
    let currentIndex = 0;
    const drafts = new Map();
    const hintStep = new Map();
    const answerOpen = new Map();
    const feedbackById = new Map();

    const filteredProblems = () => (activeCategory === 'all'
      ? bank.problems
      : bank.problems.filter(p => p.category === activeCategory));

    function currentProblem() {
      const list = filteredProblems();
      if (!list.length) return bank.problems[0];
      if (currentIndex < 0) currentIndex = 0;
      if (currentIndex >= list.length) currentIndex = list.length - 1;
      return list[currentIndex];
    }

    function render() {
      const list = filteredProblems();
      const prob = currentProblem();
      const isSolved = solved.has(prob.id);
      const draft = drafts.get(prob.id) ?? '';
      const shownHints = hintStep.get(prob.id) || 0;
      const showAnswer = Boolean(answerOpen.get(prob.id));
      const feedback = feedbackById.get(prob.id) || null;
      const expected = getExpectedResult(prob, bank.tables);
      const expectedCols = prob.target.fields || expected.columns.map(name => ({ name, label: '' }));
      const levelClass = prob.level === '신문법' ? 'is-new' : prob.level === '응용' ? 'is-adv' : 'is-basic';

      slot.innerHTML = `
        <div class="sqlp-workbench">
          <div class="sqlp-toolbar">
            <div class="sqlp-cat-pills" role="group" aria-label="문제 카테고리 필터">
              ${bank.categories.map(cat => {
                const count = cat.id === 'all' ? bank.problems.length : bank.problems.filter(p => p.category === cat.id).length;
                return `<button type="button" class="sqlp-cat-pill${activeCategory === cat.id ? ' active' : ''}" data-sqlp-cat="${esc(cat.id)}">${esc(cat.label)} <span>${count}</span></button>`;
              }).join('')}
            </div>
            <div class="sqlp-nav-controls">
              <span class="sqlp-progress-pill" aria-live="polite">푼 문제 <strong>${solved.size}</strong> / ${bank.problems.length}</span>
              <button type="button" class="sqlp-nav-btn" data-sqlp-prev ${currentIndex <= 0 ? 'disabled' : ''}>이전</button>
              <select class="sqlp-jump-select" id="sqlpJumpSelect" aria-label="문제 선택">
                ${list.map((p, idx) => `<option value="${idx}"${idx === currentIndex ? ' selected' : ''}>${esc(p.num)} · ${esc(p.categoryLabel)}${solved.has(p.id) ? ' ✓' : ''}</option>`).join('')}
              </select>
              <button type="button" class="sqlp-nav-btn" data-sqlp-next ${currentIndex >= list.length - 1 ? 'disabled' : ''}>다음</button>
            </div>
          </div>

          <div class="sqlp-card">
            <div class="sqlp-qhead">
              <div class="sqlp-qhead-meta">
                <span class="sqlp-qnum">${esc(prob.num)}</span>
                <span class="sqlp-chip">${esc(prob.categoryLabel)}</span>
                <span class="sqlp-chip ${levelClass}">${esc(prob.level)}</span>
                ${prob.syntax === 'either' ? '<span class="sqlp-chip is-dual">구문법 · 신문법 모두 채점</span>' : '<span class="sqlp-chip is-strict">Strict Mode 필수</span>'}
                ${isSolved ? '<span class="sqlp-solved-badge">✓ 푼 문제</span>' : ''}
              </div>
              <p class="sqlp-prompt">${fmtInline(prob.prompt)}</p>
              ${prob.note ? `<p class="sqlp-note">${fmtInline(prob.note)}</p>` : ''}
            </div>

            <div class="sqlp-grid">
              <div class="sqlp-left">
                <div class="sqlp-block-group">
                  <div class="sqlp-block-label">사용할 테이블</div>
                  ${prob.tables.map(tName => {
                    const tbl = bank.tables[tName];
                    if (!tbl) return '';
                    const rowMatrix = tbl.rows.map(r => tbl.columns.map(c => r[c.name]));
                    return `
                      <div class="sqlp-table-section">
                        <div class="sqlp-table-title"><strong>${esc(tbl.name)}</strong><span>${esc(tbl.koName)}</span></div>
                        ${renderDataTable(tbl.columns, rowMatrix)}
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="sqlp-block-group">
                  <div class="sqlp-block-label">기대 결과 <span class="sqlp-target-sub">${esc(prob.target.label)} · ${expected.rows.length}행</span></div>
                  ${renderDataTable(expectedCols, expected.rows)}
                </div>
              </div>

              <div class="sqlp-right">
                <div class="sqlp-sticky">
                  <div class="sqlp-block-group">
                    <div class="sqlp-block-label">주어진 선언</div>
                    <pre class="sqlp-decl-code"><code>${highlightAbap(prob.declarations)}</code></pre>
                  </div>

                  <div class="sqlp-block-group">
                    <div class="sqlp-editor-head">
                      <label for="sqlpEditor" class="sqlp-block-label">SELECT문을 작성하세요</label>
                      <span class="sqlp-shortcut-hint">Ctrl + Enter 채점</span>
                    </div>
                    <div class="sqlp-editor-shell">
                      <div class="sqlp-gutter" id="sqlpGutter" aria-hidden="true"></div>
                      <div class="sqlp-editor-stack">
                        <pre class="sqlp-highlight-layer" id="sqlpHighlightLayer" aria-hidden="true"></pre>
                        <textarea id="sqlpEditor" class="sqlp-textarea" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="SELECT ...&#10;  FROM ...&#10;  INTO TABLE ...">${esc(draft)}</textarea>
                      </div>
                    </div>
                  </div>

                  <div class="sqlp-actions">
                    <button type="button" class="sqlp-btn-primary" data-sqlp-grade>채점</button>
                    <button type="button" class="sqlp-btn-secondary" data-sqlp-hint ${shownHints >= (prob.hints?.length || 0) ? 'disabled' : ''}>힌트${prob.hints?.length ? ` (${shownHints}/${prob.hints.length})` : ''}</button>
                    <button type="button" class="sqlp-btn-secondary" data-sqlp-answer>${showAnswer ? '정답 숨기기' : '정답 보기'}</button>
                    <button type="button" class="sqlp-btn-ghost" data-sqlp-clear>초기화</button>
                  </div>

                  ${feedback ? `
                    <div class="sqlp-feedback is-${esc(feedback.status)}" role="status">
                      <div class="sqlp-feedback-title">${esc(feedback.title)}</div>
                      <p class="sqlp-feedback-msg">${fmtInline(feedback.message)}</p>
                      ${feedback.status === 'mismatch' && feedback.actual ? `
                        <div class="sqlp-actual-preview">
                          <div class="sqlp-actual-label">작성한 쿼리 실행 결과 (${feedback.actual.rows.length}행)</div>
                          ${renderDataTable(feedback.actual.columns.map(name => ({ name })), feedback.actual.rows)}
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}

                  ${shownHints > 0 && prob.hints?.length ? `
                    <div class="sqlp-hints-box">
                      ${prob.hints.slice(0, shownHints).map((h, i) => `
                        <div class="sqlp-hint-item"><strong>힌트 ${i + 1}</strong><p>${fmtInline(h)}</p></div>
                      `).join('')}
                    </div>
                  ` : ''}

                  ${showAnswer ? `
                    <div class="sqlp-answer-box">
                      <div class="sqlp-answer-header">정답 예시</div>
                      ${prob.answers.classic ? `
                        <div class="sqlp-answer-variant">
                          <span class="sqlp-answer-tag is-classic">구문법 (Classic)</span>
                          <pre class="sqlp-decl-code"><code>${highlightAbap(prob.answers.classic)}</code></pre>
                        </div>
                      ` : ''}
                      ${prob.answers.new ? `
                        <div class="sqlp-answer-variant">
                          <span class="sqlp-answer-tag is-new">신문법 (7.40+ Strict Mode)</span>
                          <pre class="sqlp-decl-code"><code>${highlightAbap(prob.answers.new)}</code></pre>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="sqlp-footer-nav">
              <button type="button" class="sqlp-nav-btn" data-sqlp-prev ${currentIndex <= 0 ? 'disabled' : ''}>← 이전 문제</button>
              <button type="button" class="sqlp-nav-btn" data-sqlp-next ${currentIndex >= list.length - 1 ? 'disabled' : ''}>다음 문제 →</button>
            </div>
          </div>
        </div>
      `;

      syncEditorDisplay();
    }

    function syncEditorDisplay() {
      const textarea = slot.querySelector('#sqlpEditor');
      const layer = slot.querySelector('#sqlpHighlightLayer');
      const gutter = slot.querySelector('#sqlpGutter');
      if (!textarea || !layer || !gutter) return;
      const val = textarea.value;
      const lines = Math.max(5, val.split('\n').length);
      layer.innerHTML = highlightAbap(val) + (val.endsWith('\n') ? ' ' : '\n');
      gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      layer.scrollTop = textarea.scrollTop;
      layer.scrollLeft = textarea.scrollLeft;
      gutter.scrollTop = textarea.scrollTop;
    }

    function runGrade() {
      const prob = currentProblem();
      const textarea = slot.querySelector('#sqlpEditor');
      const code = textarea ? textarea.value : (drafts.get(prob.id) || '');
      drafts.set(prob.id, code);
      const res = grade(prob, code, bank);
      feedbackById.set(prob.id, res);
      window.CodeWikiTelemetry?.trackQuizAnswer?.('sql-practice', prob.id, `${prob.num} ${prob.title || ''}`.trim(), res.status === 'correct');
      if (res.status === 'correct' && !solved.has(prob.id)) {
        solved.add(prob.id);
        saveSolved(userId, solved);
      }
      render();
    }

    slot.addEventListener('click', e => {
      const catBtn = e.target.closest('[data-sqlp-cat]');
      if (catBtn) {
        activeCategory = catBtn.dataset.sqlpCat;
        currentIndex = 0;
        render();
        return;
      }
      if (e.target.closest('[data-sqlp-prev]')) {
        if (currentIndex > 0) { currentIndex--; render(); }
        return;
      }
      if (e.target.closest('[data-sqlp-next]')) {
        if (currentIndex < filteredProblems().length - 1) { currentIndex++; render(); }
        return;
      }
      if (e.target.closest('[data-sqlp-grade]')) {
        runGrade();
        return;
      }
      if (e.target.closest('[data-sqlp-hint]')) {
        const prob = currentProblem();
        const cur = hintStep.get(prob.id) || 0;
        if (cur < (prob.hints?.length || 0)) {
          hintStep.set(prob.id, cur + 1);
          render();
        }
        return;
      }
      if (e.target.closest('[data-sqlp-answer]')) {
        const prob = currentProblem();
        answerOpen.set(prob.id, !answerOpen.get(prob.id));
        render();
        return;
      }
      if (e.target.closest('[data-sqlp-clear]')) {
        const prob = currentProblem();
        drafts.set(prob.id, '');
        feedbackById.delete(prob.id);
        render();
        slot.querySelector('#sqlpEditor')?.focus?.();
      }
    });

    slot.addEventListener('change', e => {
      if (e.target.id === 'sqlpJumpSelect') {
        const nextIdx = Number(e.target.value);
        if (Number.isInteger(nextIdx)) {
          currentIndex = nextIdx;
          render();
        }
      }
    });

    slot.addEventListener('input', e => {
      if (e.target.id === 'sqlpEditor') {
        const prob = currentProblem();
        drafts.set(prob.id, e.target.value);
        syncEditorDisplay();
      }
    });

    slot.addEventListener('scroll', e => {
      if (e.target.id === 'sqlpEditor') {
        const layer = slot.querySelector('#sqlpHighlightLayer');
        const gutter = slot.querySelector('#sqlpGutter');
        if (layer) { layer.scrollTop = e.target.scrollTop; layer.scrollLeft = e.target.scrollLeft; }
        if (gutter) gutter.scrollTop = e.target.scrollTop;
      }
    }, true);

    slot.addEventListener('keydown', e => {
      if (e.target.id !== 'sqlpEditor') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runGrade();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
        const prob = currentProblem();
        drafts.set(prob.id, ta.value);
        syncEditorDisplay();
      }
    });

    for (const inst of [...activeMounts]) {
      if (!inst.isConnected()) activeMounts.delete(inst);
    }
    const instance = {
      isConnected: () => Boolean(slot.isConnected),
      syncUser(nextUserId) {
        if (!slot.isConnected) {
          activeMounts.delete(instance);
          return;
        }
        if (nextUserId === userId) return;
        userId = nextUserId;
        solved = loadSolved(userId);
        drafts.clear();
        hintStep.clear();
        answerOpen.clear();
        feedbackById.clear();
        currentIndex = 0;
        activeCategory = 'all';
        render();
      }
    };
    activeMounts.add(instance);
    render();
    return instance;
  }

  function setUser(user) {
    currentUserId = user?.role === 'student' && user.status === 'approved' ? user.id : null;
    for (const inst of [...activeMounts]) inst.syncUser(currentUserId);
  }

  window.WIKI_WIDGETS = window.WIKI_WIDGETS || {};
  window.WIKI_WIDGETS['abap-sql-practice'] = mount;
  window.CodeWikiSqlPractice = { parse, execute, grade, getExpectedResult, highlightAbap, mount, setUser };
})();
