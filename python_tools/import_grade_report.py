"""Import one Clemson grade distribution PDF, using the report's displayed precision."""
import argparse
import csv
import re
import subprocess
from pathlib import Path

ROW = re.compile(r'^([A-Z]+)\s+(\w+)\s+(\w+)\s+(.+?)\s+((?:(?:\d+%|####)\s+){9})(.+)$')
TERM = re.compile(r'^Grades Report for (\d{4})(01|08)$')

def read_report(pdf):
    text = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-']).decode()
    terms, rows = set(), []
    for line in text.splitlines():
        match = TERM.match(line)
        if match:
            terms.add(match.groups())
        if re.match(r'^[A-Z]+\s+\d', line) or '%' in line:
            match = ROW.fullmatch(line.rstrip())
            if not match:
                raise ValueError(f'Unrecognized grade row: {line}')
            subject, number, section, title, values, instructor = match.groups()
            grades = ['' if v == '####' else v for v in values.split()]
            if any(v and not 0 <= int(v[:-1]) <= 100 for v in grades):
                raise ValueError(line)
            name, *honors = re.split(r'\s{2,}(?=H$)', instructor.strip())
            rows.append([subject, number, section, title.strip(), *grades, next(iter(honors),''), name])
        elif re.fullmatch(r'\s{100,}\S.*', line):
            rows[-1][-1] += ' ' + line.strip()
    if len(terms) != 1 or not rows:
        raise ValueError('Expected one term and at least one course section')
    year, semester = terms.pop()
    return year + ('Spring' if semester == '01' else 'Fall'), rows

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'grade_distributions_final')
    args = parser.parse_args()
    term, rows = read_report(args.pdf)
    with (args.output / (term + '.csv')).open('w', newline='') as out:
        csv.writer(out, lineterminator='\n').writerows(rows)
    print(f'{term}: {len(rows)} source rows')
