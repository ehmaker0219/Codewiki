"""Read the supplied student workbook, reconcile dates, emit static calendar data.
Usage: python scripts/import-schedule.py SOURCE.xlsx
The source is never modified. Requires openpyxl for read-only extraction.
"""
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
import openpyxl

source = Path(sys.argv[1])
wb = openpyxl.load_workbook(source, data_only=True)
overview = wb['전체 일정']
weekly = wb['주간 달력']
start, end = dt.date(2026, 10, 19), dt.date(2027, 7, 14)

def iso_short(value):
    match = re.search(r'(\d{1,2})/(\d{1,2})', str(value))
    month, day = map(int, match.groups())
    return dt.date(2026 if month >= 10 else 2027, month, day).isoformat()

phase_ranges = [
    (7, [('2026-10-19', '2026-11-10')]),
    (8, [('2026-11-11', '2027-01-19')]),
    (9, [('2027-01-21', '2027-02-03'), ('2027-06-17', '2027-06-25')]),
    (10, [('2027-02-04', '2027-02-26')]),
    (11, [('2027-03-02', '2027-06-15'), ('2027-06-28', '2027-07-14')]),
]
phases = [dict(id=f'phase-{row}', name=overview.cell(row,3).value,
               period=overview.cell(row,4).value, description=overview.cell(row,5).value,
               ranges=[dict(start=a,end=b) for a,b in ranges], source=f'전체 일정!C{row}:E{row}')
          for row,ranges in phase_ranges]
milestones = [dict(date=iso_short(overview.cell(row,2).value), title=overview.cell(row,3).value,
                   source=f'전체 일정!B{row}:C{row}') for row in range(15,23)]
holidays = {iso_short(item):re.sub(r'^\s*\d+/\d+\s*','',item).strip()
            for item in overview['C25'].value.split(',')}
breaks = {iso_short(item) for item in overview['C26'].value.split('※')[0].split(',')}
entries = []
for row in range(4,81,2):
    week_start = dt.date.fromisoformat(str(weekly.cell(row,2).value).replace('.','-'))
    for col in range(2,7):
        title = weekly.cell(row+1,col).value
        if not title: continue
        date = week_start + dt.timedelta(days=col-2)
        # Verify each printed date agrees with its weekday column; never silently shift it.
        parts = list(map(int,str(weekly.cell(row,col).value).split('.')))
        printed = dt.date(*parts) if len(parts)==3 else dt.date(date.year,*parts)
        assert date == printed, (row,col,date,printed)
        assert start <= date <= end
        key = date.isoformat()
        phase = next((p for p in phases if any(r['start']<=key<=r['end'] for r in p['ranges'])),None)
        kind = 'holiday' if key in holidays or key in breaks else 'assessment' if str(title).startswith('평가') else 'project' if title in ['프로젝트','RAP POU','수료식','보강'] else 'ui' if phase and phase['name'].startswith('UI') else 'abap'
        entries.append(dict(date=key,title=title,kind=kind,phaseId=phase['id'] if phase else None,
                            week=(row-4)//2+1, holiday=holidays.get(key), isBreak=key in breaks,
                            milestones=[m['title'] for m in milestones if m['date']==key],
                            source=f'주간 달력!{weekly.cell(row,col).coordinate}:{weekly.cell(row+1,col).coordinate}'))
expected = { (start+dt.timedelta(days=i)).isoformat() for i in range((end-start).days+1)
             if (start+dt.timedelta(days=i)).weekday()<5 }
assert len(entries) == len({e['date'] for e in entries})
assert {e['date'] for e in entries} == expected
assert holidays.keys() <= expected and breaks <= expected
assert all(m['date'] in expected for m in milestones)
payload = dict(sourceFile=source.name, sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
               revision='2026-11-11', title=overview['B2'].value,
               period=overview['B3'].value, start=start.isoformat(),end=end.isoformat(),
               hours='09:00–18:00', note=overview['B28'].value.lstrip('※ '),
               phases=phases,milestones=milestones,entries=entries)
target=Path(__file__).resolve().parents[1]/'js/schedule-data.js'
target.write_text('/** Imported from the student schedule. Run scripts/import-schedule.py to refresh. */\nwindow.WIKI_SCHEDULE = '+json.dumps(payload,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(json.dumps(dict(entries=len(entries),holidays=len(holidays),breaks=len(breaks),milestones=len(milestones),first=entries[0]['date'],last=entries[-1]['date']),ensure_ascii=False))
