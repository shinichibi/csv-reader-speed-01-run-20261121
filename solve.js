// A fast CSV reader with csv-reader 1.0.0's exact answers.
//
// run(input) reads input {text, header} once, left to right, and returns
// {columns, rows, errors} with the reference reader's broken-row policy:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is
//     no record;
//   - outside quotes, a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not
//     doubled: "" inside it is one quote, and each CRLF or lone CR inside
//     it is read as LF; what follows the closing quote, up to the next
//     comma or line break, is appended as it stands (quote_junk, when the
//     field ends); a quote that never closes is a literal character and
//     the text after it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields
//     stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows
//     holds the records after it (every record when header is false),
//     each padded with "" (short_row, with fields: its field count) or
//     cut (long_row, with extra: the cut fields) to the first record's
//     width;
//   - each error is {code, line, row} in the order met: line the 1-based
//     line its record starts on (every LF, CRLF and lone CR inside a
//     quoted field counted), row its record's index in rows, null for
//     the header.
//
// Where the reference builds each field a character at a time, this
// reader scans for the next character that can change the reading and
// takes whole spans of the text with slice(); only a field that really
// is broken (a stray CR, a doubled quote, a line break inside quotes)
// falls back to assembling its value from pieces.

const COMMA_END = 0;
const BREAK_END = 1;
const TEXT_END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows
  // it takes (null: the header). Errors name the record they were met in.
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and (for a field read
  // onto a prefix) how many characters past the prefix were kept.
  let fVal = '';
  let fEnd = TEXT_END;
  let fAdded = 0;

  function fail(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `prefix` up to the next comma or line
  // break: a CR not followed by LF is dropped (stray_cr). Sets fVal,
  // fEnd and fAdded (the characters kept past the prefix).
  function readUnquoted(prefix) {
    const start = pos;
    let i = pos;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44 || c === 10) { // , or LF: the field ends here
        fAdded = i - start;
        fVal = prefix + text.slice(start, i);
        pos = i + 1;
        if (c === 10) line += 1;
        fEnd = c === 10 ? BREAK_END : COMMA_END;
        return;
      }
      if (c === 13) { // CR
        if (text.charCodeAt(i + 1) === 10) { // CRLF: the field ends here
          fAdded = i - start;
          fVal = prefix + text.slice(start, i);
          pos = i + 2;
          line += 1;
          fEnd = BREAK_END;
          return;
        }
        readUnquotedBroken(prefix, start, i);
        return;
      }
      i += 1;
    }
    fAdded = n - start;
    fVal = prefix + text.slice(start, n);
    pos = n;
    fEnd = TEXT_END;
  }

  // The rest of readUnquoted once a stray CR is met at i: the field's
  // value is assembled from the spans between the CRs it drops.
  function readUnquotedBroken(prefix, start, i) {
    const pieces = [prefix, text.slice(start, i)];
    let kept = i - start;
    fail('stray_cr');
    i += 1;
    let span = i;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 44 || c === 10) {
        kept += i - span;
        pieces.push(text.slice(span, i));
        fAdded = kept;
        fVal = pieces.join('');
        pos = i + 1;
        if (c === 10) line += 1;
        fEnd = c === 10 ? BREAK_END : COMMA_END;
        return;
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          kept += i - span;
          pieces.push(text.slice(span, i));
          fAdded = kept;
          fVal = pieces.join('');
          pos = i + 2;
          line += 1;
          fEnd = BREAK_END;
          return;
        }
        fail('stray_cr');
        kept += i - span;
        pieces.push(text.slice(span, i));
        i += 1;
        span = i;
        continue;
      }
      i += 1;
    }
    kept += n - span;
    pieces.push(text.slice(span, n));
    fAdded = kept;
    fVal = pieces.join('');
    pos = n;
    fEnd = TEXT_END;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let i = pos + 1;
    let span = i; // the start of the span not yet cut into pieces
    let pieces = null; // spans and substitutions, once the field needs them
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) { // "
        if (text.charCodeAt(i + 1) === 34) { // "" is one quote
          if (pieces === null) pieces = [text.slice(span, i), '"'];
          else pieces.push(text.slice(span, i), '"');
          i += 2;
          span = i;
          continue;
        }
        // The closing quote.
        let value;
        if (pieces === null) value = text.slice(span, i);
        else {
          pieces.push(text.slice(span, i));
          value = pieces.join('');
        }
        pos = i + 1;
        finishQuoted(value);
        return;
      }
      if (c === 13) { // CRLF and a lone CR inside quotes are each one LF
        if (pieces === null) pieces = [text.slice(span, i), '\n'];
        else pieces.push(text.slice(span, i), '\n');
        line += 1;
        i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
        span = i;
        continue;
      }
      if (c === 10) line += 1; // an LF inside quotes stays an LF
      i += 1;
    }
    // The quote never closes: it is a literal character, and the text
    // after it is read again as unquoted.
    pos = open + 1;
    line = openLine;
    fail('unterminated_quote');
    readUnquoted('"');
  }

  // A quoted field has closed at pos: ends it, or reads the junk that
  // follows its closing quote onto its value.
  function finishQuoted(value) {
    if (pos >= n) {
      fVal = value;
      fEnd = TEXT_END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fVal = value;
      fEnd = COMMA_END;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fVal = value;
      fEnd = BREAK_END;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fVal = value;
      fEnd = BREAK_END;
      return;
    }
    readUnquoted(value);
    if (fAdded > 0) fail('quote_junk');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fVal);
    } while (fEnd === COMMA_END);

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
